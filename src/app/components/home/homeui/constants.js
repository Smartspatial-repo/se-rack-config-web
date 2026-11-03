export const DEFAULT_SHARED_CONTROLS = {
  rackView: "back",
  rackHidden: false,
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
  { id: "ocp-powershell", label: "OCP PowerShell" },
];

export const SLOT_IDS = Array.from({ length: 6 }, (_, row) =>
  ["A", "B", "C", "D"].map((column) => `${column}${row + 1}`),
).flat();
