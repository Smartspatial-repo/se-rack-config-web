"use client";

import { memo, useId, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { ArrowDownUp, Brackets, Check, Cpu, Network, Plug, Plus, Server, Snowflake, X } from "lucide-react";
import { alpha } from "@mui/material/styles";
import { EQUIPMENT_OPTIONS, SLOT_IDS } from "../homeui/constants";

const equipmentIcons = {
  "generic-server": Server,
  "generic-switch": Network,
  "ocp-powershell": Plug,
  cpu: Cpu,
  "cpu-upper": Cpu,
  "rack-brace": Brackets,
  cdu: Snowflake,
};
const equipmentLabels = {
  ...Object.fromEntries(EQUIPMENT_OPTIONS.map((option) => [option.id, option.label])),
  "cpu-upper": "CPU (upper unit)",
  cdu: "CDU",
};

// U01 retains A1's existing MQTT mapping; new units append to that contract.
// A rack elevation reads from its highest unit at the top to U01 at the bottom.
const rackSlots = SLOT_IDS.map((slotId, index) => ({
  slotId,
  label: `U${String(index + 1).padStart(2, "0")}`,
})).reverse();
const unitLabels = Object.fromEntries(rackSlots.map(({ slotId, label }) => [slotId, label]));

function cpuRange(anchorIndex) {
  return `${unitLabels[SLOT_IDS[anchorIndex]]}–${unitLabels[SLOT_IDS[anchorIndex + 1]]}`;
}

function RackRail() {
  return (
    <Box aria-hidden="true" sx={(theme) => ({
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-evenly",
      background: `linear-gradient(90deg, ${theme.palette.background.default}, ${theme.palette.divider} 45%, ${alpha(theme.palette.text.secondary, 0.16)})`,
      borderInline: `1px solid ${alpha(theme.palette.text.secondary, 0.12)}`, borderRadius: "2px",
    })}>
      {[0, 1, 2].map((hole) => (
        <Box key={hole} sx={{ width: 4, height: 5, borderRadius: "1px", bgcolor: "background.default", boxShadow: "0 1px 0 rgba(174,196,220,0.15)" }} />
      ))}
    </Box>
  );
}

function RackScrew() {
  return <Box aria-hidden="true" sx={(theme) => ({
    width: 7, height: 7, flexShrink: 0, borderRadius: "50%", border: `1px solid ${alpha(theme.palette.text.secondary, 0.3)}`,
    background: `linear-gradient(135deg, transparent 42%, ${theme.palette.background.default} 43%, ${theme.palette.background.default} 57%, transparent 58%), ${theme.palette.divider}`,
  })} />;
}

function RackHandle() {
  return <Box aria-hidden="true" sx={(theme) => ({
    width: 5, height: 20, flexShrink: 0, borderRadius: "2px", border: `1px solid ${alpha(theme.palette.text.secondary, 0.22)}`,
    backgroundColor: theme.palette.background.default,
    boxShadow: `1px 0 0 ${alpha(theme.palette.text.secondary, 0.09)}`,
  })} />;
}

export const AdvancedSXPanel = memo(function AdvancedSXPanel({
  slots = {},
  selectedSlot = null,
  onSlotSelect,
  onSlotChange,
  onCduChange,
  busy = false,
}) {
  const id = useId();
  const slotButtons = useRef({});
  const scrollArea = useRef(null);
  const [focusedSlot, setFocusedSlot] = useState(() => (
    SLOT_IDS.includes(selectedSlot) ? selectedSlot : rackSlots[0].slotId
  ));
  const activeSlot = SLOT_IDS.includes(selectedSlot) ? selectedSlot : null;
  const selectedEquipment = activeSlot ? slots[activeSlot] : null;
  const selectedIndex = SLOT_IDS.indexOf(activeSlot);
  const topSlot = selectedIndex === SLOT_IDS.length - 1;
  const cduEnabled = slots[SLOT_IDS[0]] === "cdu";
  const reserved = selectedEquipment === "cdu";
  const isCpu = selectedEquipment === "cpu" || selectedEquipment === "cpu-upper";
  const inspectorId = `${id}-inspector`;
  const occupiedCount = SLOT_IDS.filter((slotId) => equipmentLabels[slots[slotId]]).length;
  let instructions = "Choose equipment for this slot.";
  if (!activeSlot) instructions = "Choose a numbered slot in the rack to configure its equipment.";
  if (reserved) instructions = "CDU occupies U01–U04. Turn CDU off below to edit these slots.";
  if (isCpu) {
    const anchor = selectedEquipment === "cpu-upper" ? selectedIndex - 1 : selectedIndex;
    instructions = `CPU occupies ${cpuRange(anchor)}. Replacing or clearing either slot removes the whole CPU.`;
  }

  // Move only the rack's inner scroll area. Keyboard use must not jump the page.
  const focusSlot = (slotId) => {
    const button = slotButtons.current[slotId];
    const viewport = scrollArea.current;
    setFocusedSlot(slotId);
    button?.focus({ preventScroll: true });
    if (!button || !viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const row = button.getBoundingClientRect();
    if (row.top < bounds.top + 6) viewport.scrollTop -= bounds.top + 6 - row.top;
    else if (row.bottom > bounds.bottom - 6) viewport.scrollTop += row.bottom - bounds.bottom + 6;
  };

  const closeInspector = () => {
    if (busy) return;
    if (activeSlot) focusSlot(activeSlot);
    onSlotSelect(null);
  };

  const handleSlotKeyDown = (event, index) => {
    let nextIndex;
    if (event.key === "ArrowDown") nextIndex = Math.min(index + 1, rackSlots.length - 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(index - 1, 0);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = rackSlots.length - 1;
    else return;
    event.preventDefault();
    focusSlot(rackSlots[nextIndex].slotId);
  };

  return (
    <Box component="section" aria-labelledby={`${id}-title`} sx={{ minWidth: 0 }}>
      <Typography id={`${id}-title`} component="h2" variant="h3">Advanced SX</Typography>
      <Typography component="p" variant="body" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Select one of 48 rack slots, then choose equipment.
      </Typography>

      {/* Use the same columns and gutter as the MGX / Advanced SX choices above. */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, alignItems: "start", gap: { xs: 2, md: 2.5 } }}>
        <Box
          data-rack-frame
          sx={(theme) => ({
            width: "100%",
            height: { xs: 480, sm: 600, md: 640 },
            minWidth: 0,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
            background: `linear-gradient(90deg, ${theme.palette.divider}, ${theme.palette.background.paper} 14px, ${theme.palette.background.default} 32px, ${theme.palette.background.default} calc(100% - 32px), ${theme.palette.background.paper} calc(100% - 14px), ${theme.palette.divider})`,
            boxShadow: `inset 0 0 0 4px ${alpha(theme.palette.background.default, 0.75)}, inset 0 1px 0 ${alpha(theme.palette.text.secondary, 0.18)}`,
          })}
        >
          <Stack direction="row" sx={(theme) => ({ alignItems: "center", justifyContent: "space-between", gap: { xs: 1, sm: 1.5 }, flexShrink: 0, px: { xs: 1.25, sm: 2 }, py: 2, borderBottom: 1, borderColor: "divider", background: `linear-gradient(180deg, ${alpha(theme.palette.divider, 0.5)}, ${theme.palette.background.paper})` })}>
            <RackScrew />
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
              <Box aria-hidden="true" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "secondary.main", flexShrink: 0 }} />
              <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>48U rack</Typography>
            </Stack>
            <Box aria-hidden="true" sx={(theme) => ({ flex: 1, minWidth: 16, maxWidth: 130, height: 12, mx: 1, opacity: 0.6, display: { xs: "none", sm: "block" }, background: `repeating-linear-gradient(90deg, ${theme.palette.background.default} 0 3px, ${theme.palette.divider} 3px 5px)`, borderRadius: "2px" })} />
            <Typography component="span" variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>{occupiedCount} / 48 filled</Typography>
            <RackScrew />
          </Stack>

          <Box
            ref={scrollArea}
            data-rack-scroll
            role="group"
            aria-label="Advanced SX: 48 vertical rack slots"
            aria-describedby={`${id}-keyboard`}
            sx={(theme) => ({
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              overflowY: "auto",
              overflowX: "hidden",
              // Allow page scrolling to resume naturally at the top/bottom.
              overscrollBehaviorY: "auto",
              scrollbarGutter: "stable",
              scrollbarWidth: "thin",
              scrollbarColor: `${theme.palette.primary.dark} ${theme.palette.background.default}`,
              px: { xs: 1.25, sm: 2 },
              py: 1,
              "&::-webkit-scrollbar": { width: 8 },
              "&::-webkit-scrollbar-track": { backgroundColor: theme.palette.background.default },
              "&::-webkit-scrollbar-thumb": { backgroundColor: theme.palette.primary.dark, borderRadius: 8, border: `2px solid ${theme.palette.background.default}` },
            })}
          >
            <Box sx={{ display: "grid", gap: "6px" }}>
              {rackSlots.map(({ slotId, label }, index) => {
                const equipment = equipmentLabels[slots[slotId]] ? slots[slotId] : null;
                const selected = activeSlot === slotId;
                const Icon = equipment ? equipmentIcons[equipment] : null;
                return (
                  <Box key={slotId} sx={{ display: "grid", gridTemplateColumns: "10px minmax(0, 1fr) 10px", gap: { xs: "6px", sm: "9px" }, minWidth: 0 }}>
                    <RackRail />
                    <ButtonBase
                      ref={(element) => { slotButtons.current[slotId] = element; }}
                      data-slot-id={slotId}
                      tabIndex={focusedSlot === slotId ? 0 : -1}
                      aria-label={`${label}, ${equipmentLabels[equipment] || "empty"}`}
                      aria-pressed={selected}
                      aria-disabled={busy || undefined}
                      aria-controls={inspectorId}
                      onFocus={() => setFocusedSlot(slotId)}
                      onKeyDown={(event) => handleSlotKeyDown(event, index)}
                      onClick={() => {
                        if (!busy) onSlotSelect(slotId);
                      }}
                      sx={(theme) => ({
                        width: "100%", minWidth: 0, minHeight: 44,
                        display: "flex", justifyContent: "flex-start", gap: { xs: 1, sm: 1.5 }, px: { xs: 1, sm: 1.5 }, py: 0.75,
                        textAlign: "left", border: "1px solid", borderColor: selected ? "primary.main" : "divider", borderRadius: "4px",
                        backgroundColor: selected ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.background.paper, 0.9),
                        backgroundImage: `linear-gradient(180deg, ${alpha(theme.palette.text.secondary, 0.035)}, transparent 45%, ${alpha(theme.palette.background.default, 0.28)})`,
                        boxShadow: `inset 0 1px 0 ${alpha(theme.palette.text.secondary, 0.08)}, inset 0 -2px 0 ${alpha(theme.palette.background.default, 0.4)}`,
                        transition: theme.transitions.create(["background-color", "border-color"], { duration: 120 }),
                        "&:hover": { borderColor: selected ? "primary.main" : "primary.dark", backgroundColor: alpha(theme.palette.primary.main, 0.08) },
                        "&:active": { backgroundColor: alpha(theme.palette.primary.main, 0.18), transitionDuration: "0ms" },
                        "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
                        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                      })}
                    >
                      <RackHandle />
                      <Typography component="span" variant="caption" sx={{ width: 32, flexShrink: 0, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: selected ? "primary.main" : "text.secondary" }}>{label}</Typography>
                      {Icon ? <Box component={Icon} size={17} strokeWidth={1.6} aria-hidden="true" sx={{ color: "primary.light", flexShrink: 0, display: { xs: "none", sm: "block" } }} /> : null}
                      <Typography component="span" variant="body2" color={equipment ? "text.primary" : "text.secondary"} sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.8125rem" }}>{equipmentLabels[equipment] || "Empty slot"}</Typography>
                      <Box aria-hidden="true" sx={(theme) => ({ display: { xs: "none", sm: "block" }, width: { sm: 42, lg: 64 }, height: 18, flexShrink: 0, opacity: selected ? 0.65 : 0.4, backgroundImage: `radial-gradient(${theme.palette.text.secondary} 0.65px, transparent 0.85px)`, backgroundSize: "4px 4px" })} />
                      <Box component={equipment ? Check : Plus} size={16} strokeWidth={1.75} aria-hidden="true" sx={{ color: equipment ? "secondary.main" : "text.secondary", flexShrink: 0 }} />
                      <RackHandle />
                    </ButtonBase>
                    <RackRail />
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Stack direction="row" spacing={1} sx={(theme) => ({ alignItems: "center", justifyContent: "center", flexShrink: 0, minHeight: 46, px: 1.5, borderTop: 1, borderColor: "divider", color: "text.secondary", background: `linear-gradient(180deg, ${theme.palette.background.paper}, ${alpha(theme.palette.divider, 0.4)})`, boxShadow: `inset 0 -5px 0 ${alpha(theme.palette.background.default, 0.65)}` })}>
            <ArrowDownUp size={14} strokeWidth={1.75} aria-hidden="true" />
            <Typography variant="caption">Scroll to explore all 48 slots</Typography>
          </Stack>
        </Box>

        <Stack spacing={2} aria-busy={busy} sx={{ minWidth: 0 }}>
          <Box
            id={inspectorId}
            component="section"
            aria-labelledby={`${id}-slot-title`}
            onKeyDown={(event) => {
              if (event.key === "Escape" && activeSlot && !busy) {
                event.preventDefault();
                event.stopPropagation();
                closeInspector();
              }
            }}
            sx={(theme) => ({
              width: "100%", boxSizing: "border-box", minWidth: 0, minHeight: { xs: 528, sm: 512 },
              border: "1px solid", borderColor: "divider", borderRadius: 1.5, p: { xs: 2, sm: 2.5 },
              backgroundColor: alpha(theme.palette.background.paper, 0.55),
            })}
          >
            <Box key={activeSlot || "empty"} sx={{ animation: "rack-inspector-enter 140ms ease-out", "@keyframes rack-inspector-enter": { from: { opacity: 0 }, to: { opacity: 1 } }, "@media (prefers-reduced-motion: reduce)": { animation: "none" } }}>
              <Stack direction="row" sx={{ minHeight: 44, alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <Typography id={`${id}-slot-title`} component="h3" variant="subheading" aria-live="polite" aria-atomic="true">{activeSlot ? `Slot ${unitLabels[activeSlot]}` : "Select a slot"}</Typography>
                {activeSlot ? <IconButton disabled={busy} onClick={closeInspector} aria-label="Close slot options" sx={{ width: 44, height: 44 }}><X size={20} strokeWidth={1.75} aria-hidden="true" /></IconButton> : null}
              </Stack>
              <Typography component="p" variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>{instructions}</Typography>

              {activeSlot ? (
                <>
                  <Stack spacing={1.25}>
                    {EQUIPMENT_OPTIONS.map((option) => {
                      const Icon = equipmentIcons[option.id];
                      const selected = selectedEquipment === option.id;
                      const cpuOption = option.id === "cpu";
                      const disabled = busy || reserved || (cpuOption && topSlot);
                      return (
                        <ButtonBase
                          key={option.id}
                          disabled={disabled}
                          aria-pressed={selected}
                          aria-describedby={cpuOption ? `${id}-cpu-hint` : undefined}
                          aria-label={option.label}
                          onClick={() => onSlotChange(activeSlot, option.id)}
                          sx={(theme) => ({
                            display: "flex", justifyContent: "flex-start", gap: 1.5, minHeight: 56, px: 1.5, py: 1.25, textAlign: "left",
                            border: "1px solid", borderColor: selected ? "secondary.main" : "divider", borderRadius: 1,
                            backgroundColor: selected ? theme.palette.action.selected : "transparent",
                            transition: theme.transitions.create(["background-color", "border-color"], { duration: 120 }),
                            "&:hover": { backgroundColor: theme.palette.action.hover },
                            "&:active": { backgroundColor: alpha(theme.palette.secondary.main, 0.23), transitionDuration: "0ms" },
                            "&.Mui-disabled": { color: "text.disabled", borderColor: "divider" },
                            "&.Mui-disabled > svg": { color: "text.disabled" },
                            "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
                            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                          })}
                        >
                          <Box component={Icon} size={21} strokeWidth={1.75} aria-hidden="true" sx={{ color: "primary.light", flexShrink: 0 }} />
                          <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
                            <Typography component="span" variant="body2">{option.label}</Typography>
                            {cpuOption && (
                              <Typography id={`${id}-cpu-hint`} component="span" variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                {topSlot ? "No upper slot available." : `Uses ${cpuRange(selectedIndex)} and replaces overlapping equipment.`}
                              </Typography>
                            )}
                          </Box>
                          {selected ? <Box component={Check} size={18} strokeWidth={1.75} aria-hidden="true" sx={{ color: "secondary.main", flexShrink: 0 }} /> : null}
                        </ButtonBase>
                      );
                    })}
                  </Stack>
                  <Button variant="text" disabled={busy || reserved || !selectedEquipment} onClick={() => onSlotChange(activeSlot, null)} sx={{ mt: 1.5, minHeight: 44, color: "text.secondary", px: 1 }}>Clear slot</Button>
                </>
              ) : (
                <Box aria-hidden="true" sx={{ mt: 4, display: "grid", placeItems: "center", color: "divider" }}><Server size={52} strokeWidth={1} /></Box>
              )}
            </Box>
          </Box>
          <Box component="section" aria-labelledby={`${id}-cdu`} sx={(theme) => ({
            p: { xs: 2, sm: 2.5 }, border: "1px solid", borderColor: "divider", borderRadius: 1.5,
            backgroundColor: alpha(theme.palette.background.paper, 0.55),
          })}>
            <Stack component="label" direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between", cursor: busy ? "default" : "pointer" }}>
              <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
                <Typography id={`${id}-cdu`} component="span" variant="subheading" sx={{ display: "block" }}>CDU</Typography>
                <Typography id={`${id}-cdu-help`} component="span" variant="caption" color="text.secondary">
                  {cduEnabled ? "Occupies U01–U04. Turn off to free these slots." : "Turning on CDU replaces equipment overlapping U01–U04."}
                </Typography>
              </Box>
              <Switch
                checked={cduEnabled}
                disabled={busy || !onCduChange}
                onChange={(event) => onCduChange(event.target.checked)}
                slotProps={{ input: { role: "switch", "aria-labelledby": `${id}-cdu`, "aria-describedby": `${id}-cdu-help` } }}
              />
            </Stack>
          </Box>
        </Stack>
      </Box>
      <Typography id={`${id}-keyboard`} component="p" variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
        Keyboard: use ↑ / ↓ to move between slots, Enter to select, and Tab for equipment options.
      </Typography>
    </Box>
  );
});

export default AdvancedSXPanel;
