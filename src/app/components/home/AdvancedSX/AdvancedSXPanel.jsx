"use client";

import { memo, useId, useRef } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Check, Network, Plug, Plus, Server, X } from "lucide-react";
import { alpha } from "@mui/material/styles";
import { EQUIPMENT_OPTIONS, SLOT_IDS } from "../homeui/constants";

const equipmentIcons = {
  "generic-server": Server,
  "generic-switch": Network,
  "ocp-powershell": Plug,
};

const compactLabels = {
  "generic-server": "Server",
  "generic-switch": "Switch",
  "ocp-powershell": "PowerShell",
};

const equipmentLabels = Object.fromEntries(
  EQUIPMENT_OPTIONS.map((option) => [option.id, option.label]),
);

export const AdvancedSXPanel = memo(function AdvancedSXPanel({
  slots = {},
  selectedSlot = null,
  onSlotSelect,
  onSlotChange,
}) {
  const id = useId();
  const slotButtons = useRef({});
  const activeSlot = SLOT_IDS.includes(selectedSlot) ? selectedSlot : null;
  const selectedEquipment = activeSlot ? slots[activeSlot] : null;
  const inspectorId = `${id}-inspector`;

  const closeInspector = () => {
    const button = slotButtons.current[activeSlot];
    onSlotSelect(null);
    button?.focus();
  };

  return (
    <Box component="section" aria-labelledby={`${id}-title`}>
      <Typography id={`${id}-title`} component="h2" variant="h3">
        Advanced SX
      </Typography>
      <Typography variant="body" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Select a slot, then choose equipment.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "minmax(0, 1fr) 300px",
            lg: "minmax(0, 1fr) 330px",
          },
          alignItems: "start",
          gap: { xs: 2.5, md: 3 },
        }}
      >
        <Box
          role="group"
          aria-label="Advanced SX rack slots: four columns and six rows"
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: { xs: 1, sm: 1.25 },
            minWidth: 0,
          }}
        >
          {SLOT_IDS.map((slotId) => {
            const equipment = slots[slotId];
            const selected = activeSlot === slotId;

            return (
              <ButtonBase
                key={slotId}
                ref={(element) => {
                  slotButtons.current[slotId] = element;
                }}
                aria-label={`Slot ${slotId}, ${equipmentLabels[equipment] || "empty"}`}
                aria-expanded={selected}
                aria-controls={selected ? inspectorId : undefined}
                onClick={() => onSlotSelect(slotId)}
                sx={(theme) => ({
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  justifyContent: "center",
                  textAlign: "left",
                  minWidth: 0,
                  minHeight: { xs: 68, sm: 70 },
                  px: { xs: 1.25, sm: 1.75 },
                  py: 1.25,
                  border: "1px solid",
                  borderColor: selected ? "primary.main" : "divider",
                  borderRadius: 1,
                  backgroundColor: selected
                    ? alpha(theme.palette.primary.main, 0.12)
                    : alpha(theme.palette.background.paper, 0.7),
                  transition: theme.transitions.create(
                    ["background-color", "border-color"],
                    { duration: 120, easing: theme.transitions.easing.easeOut },
                  ),
                  "&:hover": {
                    borderColor: "primary.dark",
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  },
                  "&:active": {
                    backgroundColor: alpha(theme.palette.primary.main, 0.18),
                    transitionDuration: "0ms",
                  },
                })}
              >
                <Stack
                  direction="row"
                  sx={{
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 0.5,
                  }}
                >
                  <Typography
                    component="span"
                    variant="body2"
                    sx={{ fontWeight: 600 }}
                  >
                    {slotId}
                  </Typography>
                  {equipment ? (
                    <Box
                      component={Check}
                      size={15}
                      strokeWidth={1.75}
                      aria-hidden="true"
                      sx={{ color: "secondary.main", flexShrink: 0 }}
                    />
                  ) : (
                    <Box
                      component={Plus}
                      size={15}
                      strokeWidth={1.75}
                      aria-hidden="true"
                      sx={{ color: "text.secondary", flexShrink: 0 }}
                    />
                  )}
                </Stack>
                <Typography
                  component="span"
                  variant="caption"
                  color={equipment ? "text.primary" : "text.secondary"}
                  sx={{
                    mt: 0.5,
                    fontSize: { xs: "0.6875rem", sm: "0.75rem" },
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {compactLabels[equipment] || "Empty"}
                </Typography>
              </ButtonBase>
            );
          })}
        </Box>

        {activeSlot ? (
          <Box
            id={inspectorId}
            component="section"
            aria-labelledby={`${id}-slot-title`}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closeInspector();
              }
            }}
            sx={(theme) => ({
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1.5,
              p: { xs: 2, sm: 2.5 },
              backgroundColor: alpha(theme.palette.background.paper, 0.75),
              minWidth: 0,
            })}
          >
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <Typography
                id={`${id}-slot-title`}
                component="h3"
                variant="subheading"
              >
                Slot {activeSlot}
              </Typography>
              <IconButton
                size="small"
                onClick={closeInspector}
                aria-label="Close slot options"
              >
                <X size={20} strokeWidth={1.75} aria-hidden="true" />
              </IconButton>
            </Stack>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, mb: 2 }}
            >
              Choose equipment.
            </Typography>

            <Stack spacing={1.25}>
              {EQUIPMENT_OPTIONS.map((option) => {
                const Icon = equipmentIcons[option.id];
                const selected = selectedEquipment === option.id;

                return (
                  <ButtonBase
                    key={option.id}
                    aria-pressed={selected}
                    onClick={() => onSlotChange(activeSlot, option.id)}
                    sx={(theme) => ({
                      display: "flex",
                      justifyContent: "flex-start",
                      gap: 1.5,
                      minHeight: 60,
                      px: 1.75,
                      py: 1.5,
                      textAlign: "left",
                      border: "1px solid",
                      borderColor: selected ? "secondary.main" : "divider",
                      borderRadius: 1,
                      backgroundColor: selected
                        ? theme.palette.action.selected
                        : "transparent",
                      transition: theme.transitions.create(
                        ["background-color", "border-color"],
                        {
                          duration: 120,
                          easing: theme.transitions.easing.easeOut,
                        },
                      ),
                      "&:hover": {
                        backgroundColor: theme.palette.action.hover,
                      },
                      "&:active": {
                        backgroundColor: alpha(
                          theme.palette.secondary.main,
                          0.23,
                        ),
                        transitionDuration: "0ms",
                      },
                    })}
                  >
                    <Box
                      component={Icon}
                      size={22}
                      strokeWidth={1.75}
                      aria-hidden="true"
                      sx={{ color: "primary.light", flexShrink: 0 }}
                    />
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ flex: 1 }}
                    >
                      {option.label}
                    </Typography>
                    {selected ? (
                      <Box
                        component={Check}
                        size={18}
                        strokeWidth={1.75}
                        aria-hidden="true"
                        sx={{ color: "secondary.main", flexShrink: 0 }}
                      />
                    ) : null}
                  </ButtonBase>
                );
              })}
            </Stack>

            {selectedEquipment ? (
              <Button
                variant="text"
                onClick={() => onSlotChange(activeSlot, null)}
                sx={{ mt: 1.5, color: "text.secondary", px: 1 }}
              >
                Clear slot
              </Button>
            ) : null}
          </Box>
        ) : (
          <Box sx={{ px: { xs: 0, md: 2.5 }, py: { xs: 0, md: 2.5 } }}>
            <Typography component="h3" variant="subheading">
              Select a slot
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Equipment options will appear here.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
});

export default AdvancedSXPanel;
