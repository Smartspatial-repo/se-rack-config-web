"use client";

import { useId } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { Monitor, Plug, Snowflake } from "lucide-react";


function ControlHeading({ children, icon, id }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
      <Box aria-hidden="true" sx={{ display: "flex", color: "text.primary", "& svg": { width: 24, height: 24 } }}>{icon}</Box>
      <Typography id={id} component="h3" variant="subheading">{children}</Typography>
    </Stack>
  );
}


function SwitchRow({ label, checked, onChange, divider = false }) {
  return (
    <Stack component="label" direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2, minHeight: 54, cursor: "pointer", borderBottom: divider ? 1 : 0, borderColor: "divider" }}>
      <Typography component="span" variant="body">{label}</Typography>
      <Switch checked={checked} onChange={(_, value) => onChange(value)} slotProps={{ input: { "aria-label": label } }} />
    </Stack>
  );
}


export function SharedControls({ value, onChange }) {
  const id = useId();
  const setToggle = (key, checked) => onChange({ ...value, [key]: checked }, { key, value: checked });
  const setView = (view) => onChange({ ...value, rackView: view }, { key: "rackView", value: view });

  return (
    <Box component="section" aria-labelledby={`${id}-shared`} sx={{ borderTop: 1, borderColor: "divider", pt: { xs: 3, md: 3.5 } }}>
      <Typography id={`${id}-shared`} component="h2" variant="overline" color="text.secondary" sx={{ mb: 3 }}>Shared controls</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: { xs: 3, md: 0 } }}>
        <Box role="group" aria-labelledby={`${id}-view`} sx={(theme) => ({ pr: { md: 4 }, pb: { xs: 3, md: 0 }, borderBottom: { xs: `1px solid ${theme.palette.divider}`, md: 0 } })}>
          <ControlHeading id={`${id}-view`} icon={<Monitor strokeWidth={1.75} />}>Rack view</ControlHeading>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={value.rackView}
            aria-label="Rack view"
            sx={{ mt: 0.5, minHeight: 52 }}
          >
            <ToggleButton value="back" onClick={() => setView("back")}>Back view</ToggleButton>
            <ToggleButton value="front" onClick={() => setView("front")}>Front view</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box role="group" aria-labelledby={`${id}-pdu`} sx={(theme) => ({ px: { md: 4 }, pb: { xs: 3, md: 0 }, borderLeft: { md: `1px solid ${theme.palette.divider}` }, borderBottom: { xs: `1px solid ${theme.palette.divider}`, md: 0 } })}>
          <ControlHeading id={`${id}-pdu`} icon={<Plug strokeWidth={1.75} />}>PDU</ControlHeading>
          <SwitchRow label="RPDU" checked={value.rpdu} onChange={(checked) => setToggle("rpdu", checked)} divider />
          <SwitchRow label="Manifolds" checked={value.manifolds} onChange={(checked) => setToggle("manifolds", checked)} />
        </Box>

        <Box role="group" aria-labelledby={`${id}-cooling`} sx={(theme) => ({ pl: { md: 4 }, borderLeft: { md: `1px solid ${theme.palette.divider}` } })}>
          <ControlHeading id={`${id}-cooling`} icon={<Snowflake strokeWidth={1.75} />}>Cooling</ControlHeading>
          <SwitchRow label="Heat exchanger" checked={value.heatExchanger} onChange={(checked) => setToggle("heatExchanger", checked)} />
        </Box>
      </Box>
    </Box>
  );
}

export default SharedControls;
