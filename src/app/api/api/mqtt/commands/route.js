import { parseRackCommand } from "@/lib/mqtt/commands";
import {
  checkRequestOrigin,
  jsonResponse,
  MqttHttpError,
  readCommandBody,
} from "@/lib/mqtt/http";
import { MqttBridgeError, publishRackCommand } from "@/lib/mqtt/server";

export async function POST(request) {
  try {
    checkRequestOrigin(request);
    // Apply your existing app/session authorization here before publishing.
    const body = await readCommandBody(request);
    let command;
    try {
      command = parseRackCommand(body);
    } catch {
      return jsonResponse(
        {
          ok: false,
          code: "INVALID_COMMAND",
          message: "The command type or values are invalid.",
          delivery: "not-sent",
        },
        400,
      );
    }
    return jsonResponse(
      await publishRackCommand(command, { signal: request.signal }),
    );
  } catch (error) {
    if (error instanceof MqttHttpError || error instanceof MqttBridgeError) {
      return jsonResponse(
        {
          ok: false,
          code: error.code,
          message: error.message,
          delivery: error.delivery || "not-sent",
        },
        error.status,
      );
    }
    return jsonResponse(
      {
        ok: false,
        code: "COMMAND_SERVICE_ERROR",
        message: "The command service could not complete the request.",
        delivery: "unknown",
      },
      500,
    );
  }
}
