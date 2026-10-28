import { connection } from "next/server";
import { jsonResponse } from "@/lib/mqtt/http";
import { getMqttStatus } from "@/lib/mqtt/server";

export async function GET() {
  // Read live status only after a request arrives, including with Cache Components.
  await connection();
  return jsonResponse(getMqttStatus());
}
