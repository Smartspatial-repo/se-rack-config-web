import {
  buildMqttPayload,
  describeRackCommand,
  parseRackCommand,
} from "./commands.js";
import { CAMERA_BUFFER_LIMIT, createCameraStream } from "./cameraStream.js";

const CONNECT_TIMEOUT_MS = 10000;
const ACK_TIMEOUT_MS = 5000;
const MAX_PENDING = 32;
const AUTH_CODES = new Set([4, 5, 134, 135, "4", "5", "134", "135"]);
const noop = () => {};

function validateConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid browser MQTT configuration.");
  const url = new URL(value.url);
  if (
    url.protocol !== "wss:" ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Configure a secure WebSocket MQTT URL.");
  }
  if (
    typeof value.topic !== "string" ||
    !value.topic.trim() ||
    /[+#\u0000-\u001f\u007f]/.test(value.topic) ||
    new TextEncoder().encode(value.topic).length > 1024
  ) {
    throw new Error("Configure a valid MQTT command topic.");
  }
  if (
    typeof value.username !== "string" ||
    !value.username.trim() ||
    typeof value.password !== "string" ||
    !value.password.length ||
    value.username.includes("\0") ||
    value.password.includes("\0")
  ) {
    throw new Error("Configure valid browser MQTT credentials.");
  }
  return {
    url: url.toString(),
    topic: value.topic,
    username: value.username,
    password: value.password,
  };
}

function clientId() {
  const random =
    globalThis.crypto?.randomUUID?.().replaceAll("-", "") ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `se-web-${random.slice(0, 16)}`;
}

/**
 * One healthy browser connection serves every click. Reconnect creates a NEW
 * client/store, so uncertain commands from an old connection are never replayed.
 * MQTT's built-in reconnect/offline queue are deliberately disabled.
 */
export function createBrowserMqttClient({
  connect,
  onState = noop,
  onDelivery = noop,
  onError = noop,
  onPending = noop,
  onCameraPublish = noop,
} = {}) {
  if (typeof connect !== "function")
    throw new TypeError("An MQTT connect function is required.");

  let stopped = true;
  let config = null;
  let session = null;
  let retryTimer = null;
  let retryAttempt = 0;
  let generation = 0;
  const pending = new Map();

  const current = (candidate) =>
    !stopped && session === candidate && !candidate.closed;

  function clearRetry() {
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
  }

  function dispose(candidate) {
    if (!candidate || candidate.closed) return;
    candidate.closed = true;
    candidate.camera?.stop();
    clearTimeout(candidate.deadline);
    const client = candidate.client;
    if (!client) return;
    for (const [name, handler] of Object.entries(candidate.handlers))
      client.off(name, handler);
    // The no-op error listener remains through transport teardown.
    try {
      client.end(true);
    } catch {
      /* Already closed. */
    }
    try {
      client.stream?.destroy();
    } catch {
      /* Already closed. */
    }
  }

  function clearPending({
    report = false,
    code = "MQTT_DELIVERY_UNKNOWN",
    message,
  } = {}) {
    const records = [...pending.values()];
    pending.clear();
    for (const record of records) clearTimeout(record.timer);
    if (report && !stopped) {
      if (records.length) onPending(0);
      for (const record of records) {
        onError({
          commandId: record.command.commandId,
          description: record.label,
          message:
            message ||
            "The connection ended before acknowledgement. Delivery is unknown; check Unreal before repeating the action.",
          code,
          delivery: "unknown",
          canRetry: false,
        });
      }
    }
  }

  function scheduleRetry(message, code) {
    if (stopped || !config) return;
    clearRetry();
    const delay = Math.min(1000 * 2 ** Math.min(retryAttempt++, 3), 8000);
    const expectedGeneration = generation;
    onState({
      state: "connecting",
      code,
      message: `${message} Reconnecting in ${delay / 1000}s…`,
    });
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!stopped && generation === expectedGeneration) open();
    }, delay);
  }

  function fail(candidate, { code, message, retry = true }) {
    if (!current(candidate)) return;
    session = null;
    dispose(candidate);
    clearPending({
      report: true,
      code,
      message:
        "The connection ended before broker acknowledgement. Delivery is unknown; check Unreal before repeating the action.",
    });
    if (retry) scheduleRetry(message, code);
    else onState({ state: "disconnected", code, message });
  }

  function open() {
    if (stopped || !config || session) return;
    clearRetry();
    const candidate = {
      client: null,
      connected: false,
      closed: false,
      deadline: null,
      handlers: {},
    };
    session = candidate;
    onState({ state: "connecting", message: "Connecting to MQTT…" });

    const connectionFailure = (error) => {
      const auth = AUTH_CODES.has(error?.code);
      const timedOut =
        error?.code === "ETIMEDOUT" || error?.message === "connack timeout";
      fail(candidate, {
        code: auth
          ? "MQTT_AUTH_FAILED"
          : timedOut
            ? "MQTT_CONNECT_TIMEOUT"
            : "MQTT_CONNECTION_FAILED",
        message: auth
          ? "The broker rejected the browser credentials. Check the dedicated browser account and its permissions, then reconnect."
          : timedOut
            ? "The MQTT connection timed out."
            : "The MQTT WebSocket connection was interrupted.",
        retry: !auth,
      });
    };

    try {
      const client = connect(config.url, {
        username: config.username,
        password: config.password,
        clientId: clientId(),
        protocolVersion: 4,
        clean: true,
        keepalive: 30,
        connectTimeout: CONNECT_TIMEOUT_MS,
        reconnectPeriod: 0,
        queueQoSZero: false,
        resubscribe: false,
      });
      candidate.client = client;
      candidate.camera = createCameraStream({
        streamId: clientId(),
        isReady: () =>
          current(candidate) && candidate.connected && client.connected,
        canWrite: () => {
          const stream = client.stream;
          // MQTT.js browser stream exposes its WebSocket as .socket. Checking
          // both buffers avoids adding obsolete frames behind a slow network.
          return (
            !stream?.destroyed &&
            (stream?.writableLength ?? 0) < CAMERA_BUFFER_LIMIT &&
            (stream?.socket?.bufferedAmount ?? 0) < CAMERA_BUFFER_LIMIT
          );
        },
        send: (payload, callback) =>
          client.publish(
            config.topic,
            JSON.stringify(payload),
            { qos: 0, retain: false },
            callback,
          ),
        onPublish: onCameraPublish,
        onError: () =>
          fail(candidate, {
            code: "MQTT_CAMERA_WRITE_FAILED",
            message: "The MQTT connection could not send camera movement.",
          }),
      });
      client.on("error", noop);
      candidate.handlers = {
        connect: () => {
          if (!current(candidate)) return;
          candidate.connected = true;
          retryAttempt = 0;
          clearTimeout(candidate.deadline);
          onState({
            state: "connected",
            message:
              "MQTT connected. Commands publish directly over WebSocket.",
          });
        },
        error: connectionFailure,
        close: () =>
          fail(candidate, {
            code: "MQTT_DISCONNECTED",
            message: "The MQTT connection closed.",
          }),
        offline: () =>
          fail(candidate, {
            code: "MQTT_DISCONNECTED",
            message: "The MQTT connection is offline.",
          }),
      };
      for (const [name, handler] of Object.entries(candidate.handlers))
        client.on(name, handler);
      candidate.deadline = setTimeout(
        () =>
          fail(candidate, {
            code: "MQTT_CONNECT_TIMEOUT",
            message: "The broker did not connect within 10 seconds.",
          }),
        CONNECT_TIMEOUT_MS,
      );
    } catch (error) {
      connectionFailure(error);
    }
  }

  function start(value) {
    // A deliberate restart may interrupt pending commands, so classify those
    // before replacing the connection. Nothing from the old client is resent.
    clearRetry();
    ++generation;
    const previous = session;
    session = null;
    dispose(previous);
    clearPending({ report: !stopped });
    stopped = false;
    retryAttempt = 0;
    onPending(0);
    try {
      config = validateConfig(value);
    } catch {
      config = null;
      onState({
        state: "disconnected",
        code: "MQTT_BROWSER_CONFIG_INVALID",
        message:
          "Configure a secure MQTT WebSocket URL, command topic and dedicated browser credentials.",
      });
      return false;
    }
    open();
    return true;
  }

  function rejectCommand(command, code, message) {
    onError({
      ...(command
        ? {
            commandId: command.commandId,
            description: describeRackCommand(command),
          }
        : {}),
      code,
      message,
      delivery: "not-sent",
      canRetry: false,
    });
    return false;
  }

  function publish(input) {
    if (stopped) return false;
    let command;
    let payload;
    try {
      command = parseRackCommand(input);
      payload = JSON.stringify(
        buildMqttPayload(command, { format: "location" }),
      );
    } catch {
      return rejectCommand(
        null,
        "INVALID_COMMAND",
        "This configuration command is invalid and was not sent.",
      );
    }
    const candidate = session;
    if (
      !candidate ||
      !current(candidate) ||
      !candidate.connected ||
      !candidate.client.connected
    ) {
      return rejectCommand(
        command,
        "MQTT_DISCONNECTED",
        "MQTT is not connected. This click was not queued; select the option again after connecting.",
      );
    }
    if (pending.has(command.commandId)) {
      return rejectCommand(
        command,
        "COMMAND_ALREADY_PENDING",
        "This command is already awaiting acknowledgement; a second copy was not sent.",
      );
    }
    if (pending.size >= MAX_PENDING) {
      return rejectCommand(
        command,
        "MQTT_BUSY",
        "Too many commands are awaiting acknowledgement. This click was not sent; try again shortly.",
      );
    }

    const record = {
      command,
      label: describeRackCommand(command),
      timer: null,
    };
    pending.set(command.commandId, record);
    record.timer = setTimeout(() => {
      if (current(candidate) && pending.get(command.commandId) === record) {
        fail(candidate, {
          code: "MQTT_ACK_TIMEOUT",
          message: "The broker did not acknowledge a command within 5 seconds.",
        });
      }
    }, ACK_TIMEOUT_MS);
    onPending(pending.size);

    try {
      candidate.client.publish(
        config.topic,
        payload,
        { qos: 1, retain: false },
        (error) => {
          if (!current(candidate) || pending.get(command.commandId) !== record)
            return;
          if (error) {
            fail(candidate, {
              code: "MQTT_PUBLISH_FAILED",
              message: "The broker did not acknowledge a command.",
            });
            return;
          }
          clearTimeout(record.timer);
          pending.delete(command.commandId);
          onPending(pending.size);
          onDelivery({
            commandId: command.commandId,
            label: record.label,
            delivery: "broker-acknowledged",
          });
        },
      );
    } catch {
      fail(candidate, {
        code: "MQTT_PUBLISH_FAILED",
        message: "The command could not be confirmed by the broker.",
      });
    }
    // Accepted means handed to MQTT, not acknowledged or applied by Unreal.
    return true;
  }

  function reconnect() {
    return config ? start(config) : false;
  }

  function publishCamera(snapshot, options) {
    const candidate = session;
    if (!candidate || !current(candidate)) return false;
    return candidate.camera?.publish(snapshot, options) ?? false;
  }

  function stop() {
    stopped = true;
    ++generation;
    clearRetry();
    const previous = session;
    session = null;
    dispose(previous);
    clearPending();
    config = null;
  }

  return { start, publish, publishCamera, reconnect, stop };
}

export default createBrowserMqttClient;
