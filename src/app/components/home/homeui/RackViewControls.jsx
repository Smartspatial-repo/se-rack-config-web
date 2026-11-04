"use client";

import { memo, useId } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { Eye, EyeOff, Monitor } from "lucide-react";
import { alpha } from "@mui/material/styles";

// Keep the selected segment above the shared 1px border, including on focus.
const segmentStyles = (theme) => ({
  width: "100%",
  minHeight: 48,
  "& .MuiToggleButton-root": {
    position: "relative",
    zIndex: 0,
    flex: 1,
    gap: 1,
    px: { xs: 1.5, sm: 2 },
    whiteSpace: "nowrap",
    textTransform: "none",
    color: "text.secondary",
    borderColor: "divider",
    transition: theme.transitions.create(["background-color", "border-color", "color"], { duration: 120 }),
    "&.Mui-selected": {
      zIndex: 1,
      borderColor: "primary.main",
      color: "primary.main",
      backgroundColor: alpha(theme.palette.primary.main, 0.10),
      "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.16) },
    },
    "&.Mui-focusVisible": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 3,
      zIndex: 2,
    },
    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  },
});

export const RackViewControls = memo(function RackViewControls({ value, onChange }) {
  const id = useId();
  const setControl = (key, next) => onChange({ ...value, [key]: next }, { key, value: next });

  return (
    <Box
      component="section"
      aria-label="Rack view and UI visibility"
      sx={(theme) => ({
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
        gap: { xs: 3, sm: 4 },
        minWidth: 0,
        p: { xs: 2.5, md: 3 },
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        backgroundColor: alpha(theme.palette.background.paper, 0.65),
      })}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mb: 1.5 }}>
          <Monitor size={19} strokeWidth={1.75} aria-hidden="true" />
          <Typography id={`${id}-view`} component="h2" variant="subheading">Rack view</Typography>
        </Stack>
        <ToggleButtonGroup exclusive value={value.rackView} aria-labelledby={`${id}-view`} sx={segmentStyles}>
          <ToggleButton value="back" onClick={() => setControl("rackView", "back")}>Back view</ToggleButton>
          <ToggleButton value="front" onClick={() => setControl("rackView", "front")}>Front view</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mb: 1.5 }}>
          <Eye size={19} strokeWidth={1.75} aria-hidden="true" />
          <Typography id={`${id}-visibility`} component="h2" variant="subheading">UI visibility</Typography>
        </Stack>
        <ToggleButtonGroup exclusive value={value.rackHidden ? "hidden" : "visible"} aria-labelledby={`${id}-visibility`} sx={segmentStyles}>
          <ToggleButton value="hidden" onClick={() => setControl("rackHidden", true)}>
            <EyeOff size={18} strokeWidth={1.75} aria-hidden="true" />Hide
          </ToggleButton>
          <ToggleButton value="visible" onClick={() => setControl("rackHidden", false)}>
            <Eye size={18} strokeWidth={1.75} aria-hidden="true" />Unhide
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Box>
  );
});

export default RackViewControls;
