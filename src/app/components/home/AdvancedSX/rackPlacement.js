import { EQUIPMENT_OPTIONS, SLOT_IDS } from "../homeui/constants.js";

const CDU_UNITS = SLOT_IDS.slice(0, 4);
const selectableEquipment = new Set(EQUIPMENT_OPTIONS.map(({ id }) => id));

function setSlot(slotId, equipmentId) {
  return { type: "advanced-sx.slot.set", slotId, equipmentId };
}

// Return the entire installed item, in bottom-to-top rack order.
function occupiedUnits(slots, slotId) {
  const equipmentId = slots[slotId];
  if (!equipmentId) return [];
  const unit = SLOT_IDS.indexOf(slotId);
  const below = SLOT_IDS[unit - 1];
  const above = SLOT_IDS[unit + 1];
  if (equipmentId === "cpu" && slots[above] === "cpu-upper") return [slotId, above];
  if (equipmentId === "cpu-upper" && slots[below] === "cpu") return [below, slotId];
  return [slotId];
}

function clearOccupiedUnits(slots, requestedUnits) {
  const affected = new Set(requestedUnits.flatMap((id) => occupiedUnits(slots, id)));
  let next = slots;
  const steps = [];
  for (const id of SLOT_IDS) {
    if (!affected.has(id)) continue;
    const item = occupiedUnits(slots, id);
    // Keep a two-unit item together locally until both clears succeed. If the
    // sequence is interrupted, retrying can still find and clear the full pair.
    if (id === item[item.length - 1]) {
      next = { ...next };
      for (const unit of item) delete next[unit];
    }
    steps.push({ command: setSlot(id, null), slots: next });
  }
  return steps;
}

function afterClears(slots, steps) {
  return steps.length ? steps[steps.length - 1].slots : slots;
}

/** Each step includes the local occupancy to commit once its command succeeds. */
export function planRackPlacement(slots, slotId, equipmentId) {
  const index = SLOT_IDS.indexOf(slotId);
  if (index < 0 || (equipmentId !== null && !selectableEquipment.has(equipmentId))) return [];
  if (slots[CDU_UNITS[0]] === "cdu" && index < CDU_UNITS.length) return [];
  if (equipmentId === null) return clearOccupiedUnits(slots, [slotId]);

  const above = SLOT_IDS[index + 1];
  const cpu = equipmentId === "cpu";
  if (cpu && !above) return [];

  let conflicts = [];
  if (cpu) {
    const alreadyInstalled = slots[slotId] === "cpu" && slots[above] === "cpu-upper";
    if (!alreadyInstalled) conflicts = [slotId, above];
  } else if (slots[slotId] === "cpu" || slots[slotId] === "cpu-upper") {
    conflicts = [slotId];
  }
  const steps = clearOccupiedUnits(slots, conflicts);
  const next = { ...afterClears(slots, steps), [slotId]: equipmentId };
  if (cpu) next[above] = "cpu-upper";
  steps.push({ command: setSlot(slotId, equipmentId), slots: next });
  return steps;
}

export function planCduChange(slots, enabled) {
  const installed = slots[CDU_UNITS[0]] === "cdu";
  if (typeof enabled !== "boolean" || enabled === installed) return [];

  const steps = enabled ? clearOccupiedUnits(slots, CDU_UNITS) : [];
  const next = { ...afterClears(slots, steps) };
  for (const id of CDU_UNITS) {
    if (enabled) next[id] = "cdu";
    else delete next[id];
  }
  steps.push({ command: { type: "advanced-sx.cdu.set", enabled }, slots: next });
  return steps;
}
