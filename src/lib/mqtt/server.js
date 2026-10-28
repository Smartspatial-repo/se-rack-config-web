import "server-only";
import { randomUUID } from "node:crypto";
import mqtt from "mqtt";
import { buildMqttPayload } from "./commands.js";

const GLOBAL_KEY = Symbol.for("smartspatial.se-rack.mqtt.v1");
const CONNECT_TIMEOUT_MS = 8000;
const ACK_TIMEOUT_MS = 5000;
const DEDUPE_TTL_MS = 5 * 60 * 1000;
const MAX_COMMANDS = 1000;

export class MqttBridgeError extends Error {
  constructor(code, message, status = 503, delivery = "not-sent") {
    super(message);
    this.name = "MqttBridgeError";
    this.code = code;
    this.status = status;
    this.delivery = delivery;
  }
}

function readConfig() {
  const enabled = process.env.MQTT_ALLOW_COMMANDS === "true";
  const rawUrl = process.env.MQTT_URL?.trim();
  const topic = process.env.MQTT_COMMAND_TOPIC?.trim();
  const screenId = process.env.MQTT_SCREEN_ID?.trim() || "screen-01";
  if (!rawUrl || !topic) return { enabled, configured: false };
  try {
    const url = new URL(rawUrl);
    if (
      !["mqtt:", "mqtts:", "ws:", "wss:"].includes(url.protocol) ||
      !url.hostname
    )
      throw new Error("url");
    // Keep credentials in their dedicated variables, not embedded in the URL.
    if (url.username || url.password || url.hash) throw new Error("url");
    if (
      topic.includes("+") ||
      topic.includes("#") ||
      topic.includes("\0") ||
      Buffer.byteLength(topic) > 1024
    )
      throw new Error("topic");
    if (screenId.length > 128 || screenId.includes("\0"))
      throw new Error("screen");
    return {
      enabled,
      configured: true,
      url: url.toString(),
      topic,
      screenId,
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
    };
  } catch {
    return { enabled, configured: false, error: "INVALID_MQTT_CONFIG" };
  }
}

function getBridge() {
  const config = readConfig();
  const signature = JSON.stringify(config);
  let bridge = globalThis[GLOBAL_KEY];
  if (bridge?.signature === signature) return bridge;
  if (bridge?.client) bridge.client.end(true);
  bridge = {
    signature,
    config,
    client: null,
    state: !config.configured
      ? "unconfigured"
      : !config.enabled
        ? "disabled"
        : "connecting",
    error: config.error || null,
    commands: new Map(),
  };
  globalThis[GLOBAL_KEY] = bridge;
  if (!config.configured || !config.enabled) return bridge;

  try {
    const client = mqtt.connect(config.url, {
      username: config.username,
      password: config.password,
      clientId: `se-rack-${process.pid}-${randomUUID().slice(0, 12)}`,
      protocolVersion: 4,
      clean: true,
      keepalive: 30,
      connectTimeout: CONNECT_TIMEOUT_MS,
      reconnectPeriod: 1500,
      reconnectOnConnackError: true,
      queueQoSZero: false,
      resubscribe: false,
    });
    bridge.client = client;
    client.on("connect", () => {
      bridge.state = "connected";
      bridge.error = null;
    });
    client.on("reconnect", () => {
      bridge.state = "connecting";
    });
    client.on("offline", () => {
      bridge.state = "disconnected";
    });
    client.on("close", () => {
      bridge.state = "disconnected";
    });
    client.on("error", () => {
      bridge.state = "disconnected";
      // Never expose the raw error: it can contain URLs or authentication details.
      bridge.error = "MQTT_CONNECTION_FAILED";
    });
  } catch {
    bridge.state = "disconnected";
    bridge.error = "MQTT_CONNECTION_FAILED";
  }
  return bridge;
}

export function getMqttStatus() {
  const bridge = getBridge();
  return {
    configured: bridge.config.configured,
    enabled: bridge.config.enabled,
    state: bridge.state,
    ...(bridge.error ? { error: bridge.error } : {}),
  };
}

function pruneCommands(commands) {
  const now = Date.now();
  for (const [id, record] of commands) {
    if (record.settled && record.expiresAt <= now) commands.delete(id);
  }
}

/** QoS 1 acknowledgement proves broker receipt, not execution in Unreal. */
export async function publishRackCommand(command) {
  const bridge = getBridge();
  if (!bridge.config.configured)
    throw new MqttBridgeError(
      "MQTT_NOT_CONFIGURED",
      "Configure the MQTT server environment variables first.",
    );
  if (!bridge.config.enabled)
    throw new MqttBridgeError(
      "MQTT_DISABLED",
      "MQTT publishing is disabled in the server configuration.",
    );
  pruneCommands(bridge.commands);
  const signature = JSON.stringify(command);
  const previous = bridge.commands.get(command.commandId);
  if (previous) {
    if (previous.signature !== signature)
      throw new MqttBridgeError(
        "COMMAND_ID_CONFLICT",
        "This command ID has already been used for another command.",
        409,
      );
    return previous.promise;
  }
  const client = bridge.client;
  // MQTTjs sets client.connected before its store is ready. Wait for the public
  // connect event as well, so commands never enter its reconnect replay queue.
  if (!client?.connected || bridge.state !== "connected")
    throw new MqttBridgeError(
      "MQTT_DISCONNECTED",
      "The MQTT broker is not connected. The command was not queued.",
    );
  if (bridge.commands.size >= MAX_COMMANDS)
    throw new MqttBridgeError(
      "MQTT_BUSY",
      "The command service is busy. Try again shortly.",
      429,
    );

  const payload = JSON.stringify(
    buildMqttPayload(command, { screenId: bridge.config.screenId }),
  );
  const record = {
    signature,
    settled: false,
    expiresAt: Date.now() + DEDUPE_TTL_MS,
    promise: null,
  };
  record.promise = new Promise((resolve, reject) => {
    let done = false;
    let messageId;
    let timer;

    const finish = (error) => {
      if (done) return;
      done = true;
      record.settled = true;
      record.expiresAt = Date.now() + DEDUPE_TTL_MS;
      clearTimeout(timer);
      client.off("close", disconnected);
      client.off("packetsend", capturePacket);
      if (error && messageId !== undefined) {
        // An uncertain command must not be replayed later after reconnection.
        try {
          client.removeOutgoingMessage(messageId);
        } catch {
          /* Already acknowledged/removed. */
        }
      }
      if (error) reject(error);
      else
        resolve({
          ok: true,
          commandId: command.commandId,
          delivery: "broker-acknowledged",
        });
    };
    const disconnected = () =>
      finish(
        new MqttBridgeError(
          "MQTT_DELIVERY_UNKNOWN",
          "The connection closed before acknowledgement. Delivery is unknown.",
          503,
          "unknown",
        ),
      );
    const capturePacket = (packet) => {
      if (
        packet.cmd === "publish" &&
        packet.topic === bridge.config.topic &&
        packet.payload?.toString() === payload
      ) {
        messageId = packet.messageId;
      }
    };
    client.once("close", disconnected);
    client.on("packetsend", capturePacket);
    timer = setTimeout(
      () =>
        finish(
          new MqttBridgeError(
            "MQTT_ACK_TIMEOUT",
            "The broker did not acknowledge in time. Delivery is unknown.",
            504,
            "unknown",
          ),
        ),
      ACK_TIMEOUT_MS,
    );
    try {
      const previousMessageId = client.getLastMessageId();
      client.publish(
        bridge.config.topic,
        payload,
        { qos: 1, retain: false },
        (error) => {
          if (error)
            finish(
              new MqttBridgeError(
                "MQTT_PUBLISH_FAILED",
                "The broker did not acknowledge this command. Delivery is unknown.",
                503,
                "unknown",
              ),
            );
          else finish();
        },
      );
      const allocatedMessageId = client.getLastMessageId();
      if (messageId === undefined && allocatedMessageId !== previousMessageId)
        messageId = allocatedMessageId;
    } catch {
      finish(
        new MqttBridgeError(
          "MQTT_PUBLISH_FAILED",
          "The command could not be published.",
          503,
          "unknown",
        ),
      );
    }
  });
  bridge.commands.set(command.commandId, record);
  return record.promise;
}
