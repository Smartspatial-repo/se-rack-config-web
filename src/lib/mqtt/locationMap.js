// SE Rack's numeric navigation contract. These IDs are not copied from the
// AI Factory reference scene: 1, 2 and 3 are the user's requested assignments.
// All other IDs below are proposed assignments; configure the same IDs in Unreal.
// Keep actions explicit (ON and OFF, set and clear), never toggle on receipt.

const RACKS = ["mgx", "advanced-sx"];
const MODELS = ["gb300", "vera-rubin"];
const slotActions = [
  { id: "generic-server", label: "Generic server", offset: 1 },
  { id: "generic-switch", label: "Generic switch", offset: 2 },
  { id: "ocp-powershell", label: "OCP PowerShell", offset: 3 },
  { id: null, label: "Clear slot", offset: 4 },
  { id: "cpu", label: "CPU", offset: 5 },
  { id: "rack-brace", label: "Rack Brace", offset: 6 },
];
const EQUIPMENT = slotActions.map(({ id }) => id);
const TOP_SLOT = "D12"; // U48 has no unit above it for a two-unit CPU.
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

// Keys use an explicit field order. Optional HTTP command IDs are tracking data,
// not part of the semantic action or the MQTT {location: number} payload.
function commandKey(command) {
  if (!command || typeof command !== "object" || Array.isArray(command)) invalid("A command object is required.");
  if (Object.hasOwn(command, "commandId") && (typeof command.commandId !== "string"
    || !/^[A-Za-z0-9_-]{8,80}$/.test(command.commandId))) invalid("Invalid command ID.");

  let fields;
  let values;
  switch (command.type) {
    case "rack.select":
      fields = ["rack"];
      values = [oneOf(command.rack, RACKS, "rack")];
      break;
    case "mgx.model.select":
      fields = ["model"];
      values = [oneOf(command.model, MODELS, "MGX model")];
      break;
    case "rack.view.set":
      fields = ["view"];
      values = [oneOf(command.view, ["back", "front"], "rack view")];
      break;
    case "rack.visibility.set":
      fields = ["hidden"];
      if (typeof command.hidden !== "boolean") invalid("Rack hidden must be a boolean.");
      values = [command.hidden];
      break;
    case "rack.highlight.set":
      fields = ["hidden"];
      if (typeof command.hidden !== "boolean") invalid("Highlight hidden must be a boolean.");
      values = [command.hidden];
      break;
    case "accessory.set":
      fields = ["accessory", "enabled"];
      if (typeof command.enabled !== "boolean") invalid("Accessory enabled must be a boolean.");
      values = [oneOf(command.accessory, ACCESSORIES, "accessory"), command.enabled];
      break;
    case "advanced-sx.slot.focus":
      fields = ["slotId"];
      values = [slot(command.slotId, true)];
      break;
    case "advanced-sx.slot.set":
      fields = ["slotId", "equipmentId"];
      values = [slot(command.slotId), oneOf(command.equipmentId, EQUIPMENT, "equipment")];
      if (command.equipmentId === "cpu" && command.slotId === TOP_SLOT) {
        invalid("A CPU needs a second unit above the selected slot.");
      }
      break;
    case "advanced-sx.cdu.set":
      fields = ["enabled"];
      if (typeof command.enabled !== "boolean") invalid("CDU enabled must be a boolean.");
      values = [command.enabled];
      break;
    default:
      invalid("Unsupported command type.");
  }
  const allowed = new Set(["type", "commandId", ...fields]);
  if (!Object.hasOwn(command, "type") || fields.some((field) => !Object.hasOwn(command, field))
    || Object.keys(command).some((key) => !allowed.has(key))) invalid("Unexpected or missing command fields.");
  return JSON.stringify([command.type, ...values]);
}

function option(location, label, command) {
  return Object.freeze({ location, label, command: Object.freeze({ ...command }) });
}

const options = [
  option(1, "MGX", { type: "rack.select", rack: "mgx" }),
  option(2, "GB300", { type: "mgx.model.select", model: "gb300" }),
  option(3, "Vera Rubin", { type: "mgx.model.select", model: "vera-rubin" }),
  option(4, "Advanced SX", { type: "rack.select", rack: "advanced-sx" }),
  option(5, "Back view", { type: "rack.view.set", view: "back" }),
  option(6, "Front view", { type: "rack.view.set", view: "front" }),
  option(7, "RPDU on", { type: "accessory.set", accessory: "rpdu", enabled: true }),
  option(8, "RPDU off", { type: "accessory.set", accessory: "rpdu", enabled: false }),
  option(9, "Manifolds on", { type: "accessory.set", accessory: "manifolds", enabled: true }),
  option(10, "Manifolds off", { type: "accessory.set", accessory: "manifolds", enabled: false }),
  option(11, "Heat exchanger on", { type: "accessory.set", accessory: "heatExchanger", enabled: true }),
  option(12, "Heat exchanger off", { type: "accessory.set", accessory: "heatExchanger", enabled: false }),
  option(13, "Close slot selection", { type: "advanced-sx.slot.focus", slotId: null }),
  option(14, "Hide rack", { type: "rack.visibility.set", hidden: true }),
  option(15, "Unhide rack", { type: "rack.visibility.set", hidden: false }),
  option(16, "CDU on", { type: "advanced-sx.cdu.set", enabled: true }),
  option(17, "CDU off", { type: "advanced-sx.cdu.set", enabled: false }),
  option(18, "Hide highlighter", { type: "rack.highlight.set", hidden: true }),
  option(19, "Unhide highlighter", { type: "rack.highlight.set", hidden: false }),
];

// Stable row-major IDs: A1, B1, C1, D1, A2 ... D12.
// The first 24 slots retain their original IDs. The UI displays U01–U48
// (index + 1), with U48 at the top. Extend the Unreal receiver for slots 25–48.
// Slot focus: 101 + index. Equipment: 1000 + index * 10 + offset.
// The CPU command identifies the lower of its two units; a brace uses one unit.
let slotIndex = 0;
for (let row = 1; row <= 12; row++) {
  for (const column of "ABCD") {
    const slotId = `${column}${row}`;
    options.push(option(101 + slotIndex, `Focus slot ${slotId}`, { type: "advanced-sx.slot.focus", slotId }));
    for (const { id: equipmentId, label, offset } of slotActions) {
      if (equipmentId === "cpu" && slotId === TOP_SLOT) continue;
      options.push(option(1000 + slotIndex * 10 + offset, `${slotId}: ${label}`, {
        type: "advanced-sx.slot.set", slotId, equipmentId,
      }));
    }
    slotIndex++;
  }
}

export const LOCATION_OPTIONS = Object.freeze(options);
const byLocation = new Map();
const byCommand = new Map();
for (const entry of LOCATION_OPTIONS) {
  const key = commandKey(entry.command);
  if (!Number.isSafeInteger(entry.location) || entry.location < 1
    || byLocation.has(entry.location) || byCommand.has(key)) throw new Error("Invalid or duplicate location mapping.");
  byLocation.set(entry.location, entry);
  byCommand.set(key, entry.location);
}

/** Return the one numeric location assigned to a validated semantic action. */
export function getCommandLocation(command) {
  const location = byCommand.get(commandKey(command));
  if (location === undefined) invalid("This action has no location mapping.");
  return location;
}

/** Validate a numeric location and return fresh semantic fields for server use. */
export function getLocationCommand(location) {
  if (!Number.isSafeInteger(location) || !byLocation.has(location)) invalid("Unknown location ID.");
  return { ...byLocation.get(location).command };
}
