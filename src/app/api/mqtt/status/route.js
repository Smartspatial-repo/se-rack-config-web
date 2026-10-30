import { connection } from "next/server";
import { jsonResponse } from "@/lib/mqtt/http";
import { getMqttStatus } from "@/lib/mqtt/server";

export async function GET(request) {
  // Read live status only after a request arrives, including with Cache Components.
  await connection();
  return jsonResponse(await getMqttStatus({ signal: request.signal }));
}
