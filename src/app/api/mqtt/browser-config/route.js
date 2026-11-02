import { connection } from "next/server";
import { getBrowserMqttConfig } from "@/lib/mqtt/browserConfig";
import { checkRequestOrigin, MqttHttpError } from "@/lib/mqtt/http";

function respond(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      Vary: "Origin, Cookie, Authorization",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}

export async function GET(request) {
  // Compatible with Cache Components: read runtime settings only on a request.
  await connection();
  try {
    // Same-origin validation is CSRF defense, not application authentication.
    // Preserve/add your application's session authorization here if access to
    // the controller is private. Never supply a broker administrator account.
    checkRequestOrigin(request);
    return respond(getBrowserMqttConfig());
  } catch (error) {
    if (error instanceof MqttHttpError) {
      return respond({
        configured: false, enabled: false, state: "disabled",
        code: error.code, message: error.message,
      }, error.status);
    }
    return respond({
      configured: false, enabled: false, state: "unconfigured",
      code: "MQTT_BROWSER_CONFIG_FAILED",
      message: "Browser MQTT settings could not be loaded.",
    }, 500);
  }
}
