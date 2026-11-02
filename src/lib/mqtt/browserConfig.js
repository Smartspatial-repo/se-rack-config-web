import "server-only";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function readConnectionConfig(env) {
  const rawUrl = env.MQTT_BROWSER_URL?.trim();
  const topic = env.MQTT_COMMAND_TOPIC?.trim();
  const screenId = env.MQTT_SCREEN_ID?.trim() || "screen-01";
  // These credentials are deliberately delivered to the browser. Never fall
  // back to the server publisher's MQTT_USERNAME or MQTT_PASSWORD here.
  const username = env.MQTT_BROWSER_USERNAME;
  const password = env.MQTT_BROWSER_PASSWORD;

  if (!rawUrl || !topic || typeof username !== "string" || !username.trim()
    || typeof password !== "string" || !password.length) return null;

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "wss:" || !url.hostname || url.username || url.password
      || url.search || url.hash || CONTROL_CHARACTERS.test(rawUrl)) return null;
    if (/[+#]/.test(topic) || CONTROL_CHARACTERS.test(topic)
      || Buffer.byteLength(topic, "utf8") > 1024) return null;
    if (screenId.length > 128 || CONTROL_CHARACTERS.test(screenId)) return null;
    if (username.includes("\0") || password.includes("\0")
      || Buffer.byteLength(username, "utf8") > 65535
      || Buffer.byteLength(password, "utf8") > 65535) return null;
    return { url: url.toString(), topic, screenId, username, password };
  } catch {
    return null;
  }
}

/**
 * Reads settings per request; it neither connects to nor probes the broker.
 * The browser account must be restricted by broker ACL to this screen's topic.
 */
export function getBrowserMqttConfig(env = process.env) {
  const browserEnabled = env.MQTT_BROWSER_ENABLED === "true";
  const commandsEnabled = env.MQTT_ALLOW_COMMANDS === "true";
  const enabled = browserEnabled && commandsEnabled;
  const config = readConnectionConfig(env);
  const configured = config !== null;

  if (!enabled) {
    return {
      configured,
      enabled: false,
      state: "disabled",
      message: !browserEnabled
        ? "Browser MQTT is disabled. Enable MQTT_BROWSER_ENABLED in the server configuration."
        : "MQTT commands are disabled. Enable MQTT_ALLOW_COMMANDS in the server configuration.",
    };
  }

  if (!configured) {
    return {
      configured: false,
      enabled: true,
      state: "unconfigured",
      error: "MQTT_BROWSER_NOT_CONFIGURED",
      message: "Configure a valid MQTT_BROWSER_URL (wss://), dedicated browser credentials, and the screen command topic.",
    };
  }

  return {
    configured: true,
    enabled: true,
    state: "ready",
    config,
    message: "Browser MQTT settings are ready. Waiting for a broker connection.",
  };
}
