import "server-only";
import { randomUUID } from "node:crypto";
import mqtt from "mqtt";
import { buildMqttPayload, parseRackCommand } from "./commands.js";

const CACHE_KEY = Symbol.for("smartspatial.se-rack.mqtt.request-cache.v2");
const CONNECT_TIMEOUT_MS = 8000;
const ACK_TIMEOUT_MS = 5000;
const CLEANUP_TIMEOUT_MS = 800;
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
  const format = process.env.MQTT_PAYLOAD_FORMAT?.trim() || "envelope";
  if (!rawUrl || !topic) return { enabled, configured: false };
  try {
    const url = new URL(rawUrl);
    if (!["mqtt:", "mqtts:", "ws:", "wss:"].includes(url.protocol) || !url.hostname) throw new Error();
    if (url.username || url.password || url.hash) throw new Error();
    if (/[+#\0]/.test(topic) || Buffer.byteLength(topic) > 1024) throw new Error();
    if (screenId.length > 128 || screenId.includes("\0")) throw new Error();
    if (!["envelope", "flat"].includes(format)) throw new Error();
    return {
      enabled,
      configured: true,
      url: url.toString(),
      topic,
      screenId,
      format,
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
    };
  } catch {
    return { enabled, configured: false, error: "INVALID_MQTT_CONFIG" };
  }
}

function requireConfiguration(config) {
  if (!config.configured) throw new MqttBridgeError("MQTT_NOT_CONFIGURED", "Configure valid MQTT server environment variables first.");
  if (!config.enabled) throw new MqttBridgeError("MQTT_DISABLED", "MQTT publishing is disabled in the server configuration.");
}

function aborted(delivery = "not-sent") {
  return new MqttBridgeError("MQTT_REQUEST_ABORTED", delivery === "not-sent"
    ? "The request ended before the command was sent."
    : "The request ended before acknowledgement. Delivery is unknown.", 499, delivery);
}

function connectionError(error, delivery = "not-sent") {
  const code = error?.code;
  if ([4, 5, 134, 135, "4", "5", "134", "135"].includes(code)) {
    return new MqttBridgeError("MQTT_AUTH_FAILED", "The broker rejected authentication or authorization. Check the server credentials and broker permissions.", 503, delivery);
  }
  if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) {
    return new MqttBridgeError("MQTT_DNS_FAILED", "The MQTT broker hostname could not be resolved.", 503, delivery);
  }
  if (typeof code === "string" && /^(?:ERR_TLS_|ERR_SSL_|CERT_|DEPTH_ZERO_|SELF_SIGNED_|UNABLE_TO_)/.test(code)) {
    return new MqttBridgeError("MQTT_TLS_FAILED", "The MQTT TLS connection could not be verified. Check the hostname, certificate trust, protocol, and port.", 503, delivery);
  }
  // MQTTjs emits this fixed error without a code if its CONNACK timer wins.
  if (code === "ETIMEDOUT" || error?.message === "connack timeout") {
    return new MqttBridgeError("MQTT_CONNECT_TIMEOUT", "The MQTT broker connection timed out. Check network access, protocol, and port.", 503, delivery);
  }
  return new MqttBridgeError("MQTT_CONNECTION_FAILED", "The MQTT broker connection failed. Check network access, credentials, protocol, and port.", 503, delivery);
}

// Only fixed error categories and generated client IDs are logged. Never log
// connection options, raw error messages, credentials, or MQTT URLs.
function reportFailure(error, stage, clientId) {
  console.warn("[SE MQTT] request failed", { stage, clientId, code: error.code, delivery: error.delivery });
}

function waitForConnection(client, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.off("connect", onConnect);
      client.off("error", onError);
      client.off("close", onClose);
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    const onConnect = () => finish();
    const onError = (error) => finish(connectionError(error));
    const onClose = () => finish(new MqttBridgeError("MQTT_DISCONNECTED", "The MQTT connection closed before it was ready. The command was not sent."));
    const onAbort = () => finish(aborted());
    const timer = setTimeout(() => finish(new MqttBridgeError("MQTT_CONNECT_TIMEOUT", "The MQTT broker did not connect within 8 seconds. The command was not sent.")), CONNECT_TIMEOUT_MS);
    client.once("connect", onConnect);
    client.once("error", onError);
    client.once("close", onClose);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

function closeClient(client, force) {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      // No socket or reconnect loop may outlive this request, even if a graceful
      // DISCONNECT cannot complete. This session never reconnects or replays.
      try { client.end(true); } catch { /* Finish cleanup below. */ }
      try { client.stream?.destroy(); } catch { /* Already closed. */ }
      done();
    }, CLEANUP_TIMEOUT_MS);
    try { client.end(force, done); } catch {
      try { client.stream?.destroy(); } catch { /* Already closed. */ }
      done();
    }
  });
}

async function withSession(config, signal, operation) {
  if (signal?.aborted) throw aborted();
  // 23 characters: compatible with brokers enforcing the MQTT 3.1.1 minimum.
  const clientId = `se-web-${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  let client;
  let successful = false;
  let stage = "connect";
  try {
    client = mqtt.connect(config.url, {
      username: config.username,
      password: config.password,
      clientId,
      protocolVersion: 4,
      clean: true,
      keepalive: 30,
      connectTimeout: CONNECT_TIMEOUT_MS,
      reconnectPeriod: 0,
      queueQoSZero: false,
      resubscribe: false,
    });
    // Keep a handler during cleanup too; raw errors must never escape to logs.
    client.on("error", () => {});
    await waitForConnection(client, signal);
    if (signal?.aborted) throw aborted();
    if (!client.connected) throw new MqttBridgeError("MQTT_DISCONNECTED", "The broker disconnected before the operation. The command was not sent.");
    stage = "operation";
    const result = await operation(client, clientId);
    successful = true;
    return result;
  } catch (error) {
    const safeError = error instanceof MqttBridgeError ? error : connectionError(error);
    reportFailure(safeError, stage, clientId);
    throw safeError;
  } finally {
    if (client) await closeClient(client, !successful);
  }
}

/** A fresh broker handshake probe, not a claim that a background socket stays open. */
export async function getMqttStatus({ signal } = {}) {
  const config = readConfig();
  const base = { configured: config.configured, enabled: config.enabled };
  if (!config.configured || !config.enabled) {
    return {
      ...base,
      state: !config.configured ? "unconfigured" : "disabled",
      checkedAt: new Date().toISOString(),
      ...(config.error ? { error: config.error } : {}),
      message: !config.configured ? "Configure valid MQTT server environment variables first." : "MQTT publishing is disabled in the server configuration.",
    };
  }
  try {
    await withSession(config, signal, async () => {});
    return { ...base, state: "connected", checkedAt: new Date().toISOString(), message: "Broker connection verified. Each command establishes its own connection before sending." };
  } catch (error) {
    return { ...base, state: "disconnected", checkedAt: new Date().toISOString(), error: error.code, message: error.message };
  }
}

function getCommandCache(config) {
  // Only outcomes are retained between requests; no sockets or background timers.
  const configKey = JSON.stringify(config);
  let cache = globalThis[CACHE_KEY];
  if (!cache || cache.configKey !== configKey) {
    cache = { configKey, commands: new Map() };
    globalThis[CACHE_KEY] = cache;
  }
  const now = Date.now();
  for (const [id, record] of cache.commands) {
    if (record.settled && record.expiresAt <= now) cache.commands.delete(id);
  }
  return cache.commands;
}

function publishAndWait(client, config, payload, signal) {
  if (signal?.aborted) return Promise.reject(aborted());
  if (!client.connected) return Promise.reject(new MqttBridgeError("MQTT_DISCONNECTED", "The broker disconnected before publishing. The command was not sent."));
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.off("close", onClose);
      client.off("error", onError);
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    const onClose = () => finish(new MqttBridgeError("MQTT_DELIVERY_UNKNOWN", "The connection closed before broker acknowledgement. Delivery is unknown.", 503, "unknown"));
    const onError = () => finish(new MqttBridgeError("MQTT_PUBLISH_FAILED", "The broker did not acknowledge the command. Delivery is unknown.", 503, "unknown"));
    const onAbort = () => finish(aborted("unknown"));
    const timer = setTimeout(() => finish(new MqttBridgeError("MQTT_ACK_TIMEOUT", "The broker did not acknowledge within 5 seconds. Delivery is unknown.", 504, "unknown")), ACK_TIMEOUT_MS);
    client.once("close", onClose);
    client.once("error", onError);
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      client.publish(config.topic, payload, { qos: 1, retain: false }, (error) => error ? onError() : finish());
    } catch {
      onError();
    }
  });
}

/** Connect, publish, await broker receipt, close; never assume a previous GET's connection. */
export async function publishRackCommand(input, { signal } = {}) {
  const command = parseRackCommand(input);
  const config = readConfig();
  requireConfiguration(config);
  const commands = getCommandCache(config);
  const signature = JSON.stringify(command);
  const previous = commands.get(command.commandId);
  if (previous) {
    if (previous.signature !== signature) throw new MqttBridgeError("COMMAND_ID_CONFLICT", "This command ID has already been used for another command.", 409);
    return previous.promise;
  }
  if (signal?.aborted) throw aborted();
  if (commands.size >= MAX_COMMANDS) throw new MqttBridgeError("MQTT_BUSY", "The command service is busy. Try again shortly.", 429);

  const record = { signature, settled: false, expiresAt: 0, promise: null };
  // Schedule the operation in a microtask so the ID is reserved before any await
  // or connection attempt; concurrent copies share this one publish/outcome.
  record.promise = Promise.resolve().then(async () => {
    try {
      const payload = JSON.stringify(buildMqttPayload(command, { screenId: config.screenId, format: config.format }));
      const result = await withSession(config, signal, async (client, clientId) => {
        await publishAndWait(client, config, payload, signal);
        console.info("[SE MQTT] broker acknowledged", { commandId: command.commandId, clientId, screenId: config.screenId });
        return { ok: true, commandId: command.commandId, delivery: "broker-acknowledged" };
      });
      record.settled = true;
      record.expiresAt = Date.now() + DEDUPE_TTL_MS;
      return result;
    } catch (error) {
      record.settled = true;
      record.expiresAt = Date.now() + DEDUPE_TTL_MS;
      // A definitely-unsent command may be retried explicitly. Unknown outcomes
      // stay cached to avoid a duplicate publish after an ambiguous failure.
      if (error.delivery === "not-sent" && commands.get(command.commandId) === record) commands.delete(command.commandId);
      throw error;
    }
  });
  commands.set(command.commandId, record);
  return record.promise;
}
