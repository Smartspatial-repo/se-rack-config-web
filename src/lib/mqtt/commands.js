// Shared, credential-free contract used by the UI, API validation, and Unreal docs.
import { getCommandLocation, getLocationCommand } from "./locationMap.js";

export { getCommandLocation, getLocationCommand } from "./locationMap.js";

const RACKS = ["mgx", "advanced-sx"];
const MODELS = ["gb300", "vera-rubin"];
const ACCESSORIES = ["rpdu", "manifolds", "heatExchanger"];
const SLOT_PATTERN = /^[A-D](?:[1-9]|1[0-2])$/;

function invalid(message) {
  const error = new Error(message);
  error.code = "INVALID_COMMAND";
  throw error;
}

function oneOf(value, values, field) {
  if (!values.includes(value)) invalid(`Invalid ${field}.`);
  return value;
}

function slot(value, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || value !== value.trim() || !SLOT_PATTERN.test(value)) invalid("Invalid slot ID.");
  return value;
}

export function parseRackCommand(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid("A command object is required.");
  if (typeof input.commandId !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(input.commandId)) invalid("Invalid command ID.");
  const command = { commandId: input.commandId, type: input.type };
  switch (input.type) {
    case "rack.select":
      command.rack = oneOf(input.rack, RACKS, "rack");
      break;
    case "mgx.model.select":
      command.model = oneOf(input.model, MODELS, "MGX model");
      break;
    case "advanced-sx.slot.focus":
      command.slotId = slot(input.slotId, true);
      break;
    case "advanced-sx.slot.set":
      // Use the wire contract to validate the equipment, its anchor and its footprint.
      getCommandLocation(input);
      command.slotId = input.slotId;
      command.equipmentId = input.equipmentId;
      break;
    case "advanced-sx.cdu.set":
      getCommandLocation(input);
      command.enabled = input.enabled;
      break;
    case "rack.view.set":
      command.view = oneOf(input.view, ["back", "front"], "rack view");
      break;
    case "rack.visibility.set":
      if (typeof input.hidden !== "boolean") invalid("Rack hidden must be a boolean.");
      command.hidden = input.hidden;
      break;
    case "accessory.set":
      command.accessory = oneOf(input.accessory, ACCESSORIES, "accessory");
      if (typeof input.enabled !== "boolean") invalid("Accessory enabled must be a boolean.");
      command.enabled = input.enabled;
      break;
    default:
      invalid("Unsupported command type.");
  }
  // Never accept caller-controlled topics, credentials, screen IDs, or timestamps.
  if (Object.keys(input).some((key) => !Object.hasOwn(command, key))) invalid("Unexpected command fields.");
  return command;
}

export function createRackCommand(input) {
  const commandId = globalThis.crypto?.randomUUID?.()
    ?? `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return parseRackCommand({ ...input, commandId });
}

/** Browser body stays {location:N}; the request ID travels separately in a header. */
export function buildCommandRequest(input) {
  const command = parseRackCommand(input);
  return {
    headers: {
      "Content-Type": "application/json",
      "X-Command-Id": command.commandId,
    },
    body: JSON.stringify({ location: getCommandLocation(command) }),
  };
}

/** Accept the new numeric body and existing semantic API clients. */
export function parseCommandRequest(input, { commandId } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid("A command object is required.");
  if (Object.hasOwn(input, "location")) {
    if (Object.keys(input).length !== 1) invalid("Only location is allowed in a numeric command body.");
    const fields = getLocationCommand(input.location);
    return commandId === undefined
      ? createRackCommand(fields)
      : parseRackCommand({ ...fields, commandId });
  }
  const command = parseRackCommand(input);
  if (commandId !== undefined && commandId !== command.commandId) invalid("Conflicting command IDs.");
  return command;
}

export function buildMqttPayload(input, { screenId, format = "location" } = {}) {
  const command = parseRackCommand(input);
  // JSON.stringify at the publisher produces exactly {"location":N}.
  if (format === "location") return { location: getCommandLocation(command) };
  // Flat messages match the reported Unreal Phase 1 router contract.
  if (format === "flat") return { ...command, screenId };
  if (format !== "envelope") throw new Error("Unsupported MQTT payload format.");
  const { commandId, type, ...values } = command;
  const rack = type.startsWith("mgx.") ? "mgx" : type.startsWith("advanced-sx.") ? "advanced-sx" : undefined;
  return {
    version: 1,
    commandId,
    source: "se-rack-web",
    screenId,
    timestamp: new Date().toISOString(),
    type,
    payload: rack ? { rack, ...values } : values,
  };
}

export function describeRackCommand(command) {
  switch (command.type) {
    case "rack.select": return command.rack === "mgx" ? "MGX selected" : "Advanced SX selected";
    case "mgx.model.select": return command.model === "gb300" ? "GB300 selected" : "Vera Rubin selected";
    case "advanced-sx.slot.focus": return command.slotId ? `Slot ${command.slotId} selected` : "Slot selection closed";
    case "advanced-sx.slot.set": {
      const names = {
        "generic-server": "Generic server",
        "generic-switch": "Generic switch",
        "ocp-powershell": "OCP PowerShell",
        "cpu": "CPU",
        "rack-brace": "Rack Brace",
      };
      return command.equipmentId === null ? `Slot ${command.slotId} cleared` : `${command.slotId}: ${names[command.equipmentId]}`;
    }
    case "advanced-sx.cdu.set": return command.enabled ? "CDU on" : "CDU off";
    case "rack.view.set": return command.view === "front" ? "Front view selected" : "Back view selected";
    case "rack.visibility.set": return command.hidden ? "Hide rack" : "Unhide rack";
    case "accessory.set": {
      const names = { rpdu: "RPDU", manifolds: "Manifolds", heatExchanger: "Heat exchanger" };
      return `${names[command.accessory]} ${command.enabled ? "on" : "off"}`;
    }
    default: return "Rack command";
  }
}
