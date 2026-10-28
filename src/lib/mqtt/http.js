const MAX_BODY_BYTES = 4096;

export class MqttHttpError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "MqttHttpError";
    this.code = code;
    this.status = status;
  }
}

export function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// CSRF defense only. Add your application's session authorization before publishing.
export function checkRequestOrigin(request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new MqttHttpError(
      "ORIGIN_NOT_ALLOWED",
      "This request origin is not allowed.",
      403,
    );
  }
  const origin = request.headers.get("origin");
  if (!origin) return;
  try {
    const expected = new URL(process.env.APP_ORIGIN || request.url).origin;
    if (origin === "null" || new URL(origin).origin !== expected)
      throw new Error("origin");
  } catch {
    throw new MqttHttpError(
      "ORIGIN_NOT_ALLOWED",
      "This request origin is not allowed.",
      403,
    );
  }
}

export async function readCommandBody(request) {
  const type = (request.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (type !== "application/json") {
    throw new MqttHttpError(
      "INVALID_CONTENT_TYPE",
      "Send an application/json request.",
      415,
    );
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new MqttHttpError(
      "BODY_TOO_LARGE",
      "The command request is too large.",
      413,
    );
  }
  if (!request.body)
    throw new MqttHttpError("INVALID_JSON", "A JSON command is required.");
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new MqttHttpError(
          "BODY_TOO_LARGE",
          "The command request is too large.",
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new MqttHttpError(
      "INVALID_JSON",
      "The command must contain valid JSON.",
    );
  }
}
