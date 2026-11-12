export const DEFAULT_RACK = "mgx";

export const DEFAULT_SHARED_CONTROLS = {
  rackView: "front",
  rackHidden: false,
  highlightHidden: false,
  rpdu: false,
  manifolds: false,
  heatExchanger: false,
};

export const MGX_SYSTEMS = [
  { id: "gb300", label: "GB300" },
  { id: "vera-rubin", label: "Vera Rubin" },
];

export const EQUIPMENT_OPTIONS = [
  { id: "generic-server", label: "Generic server" },
  { id: "generic-switch", label: "Generic switch" },
  // { id: "ocp-powershell", label: "OCP PowerShell" },
  { id: "cpu", label: "UPS" },
  { id: "rack-brace", label: "Rack Brace" },
];

// Stable MQTT slot identities: append new rows; never renumber existing slots.
// The rack displays index + 1 as U01–U48, with U48 at the top.
export const SLOT_IDS = Array.from({ length: 12 }, (_, row) =>
  ["A", "B", "C", "D"].map((column) => `${column}${row + 1}`),
).flat();
