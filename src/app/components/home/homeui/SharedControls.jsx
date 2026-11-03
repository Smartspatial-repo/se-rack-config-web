"use client";

import { memo, useId } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import { Plug, Snowflake } from "lucide-react";
import { alpha } from "@mui/material/styles";

const MOTION = "220ms cubic-bezier(0.2, 0, 0, 1)";
const cardStyles = (theme) => ({
  minWidth: 0,
  px: { xs: 2.5, md: 3 },
  py: 2.5,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 1.5,
  backgroundColor: alpha(theme.palette.background.paper, 0.5),
});

function ControlHeading({ children, icon, id }) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{ alignItems: "center", mb: 1.5, minWidth: 0 }}
    >
      <Box
        aria-hidden="true"
        sx={{
          display: "flex",
          color: "text.secondary",
          flexShrink: 0,
          "& svg": { width: 20, height: 20 },
        }}
      >
        {icon}
      </Box>
      <Typography id={id} component="h3" variant="subheading" noWrap>
        {children}
      </Typography>
    </Stack>
  );
}

function SwitchRow({ label, checked, onChange, divider = false }) {
  return (
    <Stack
      component="label"
      direction="row"
      sx={{
        justifyContent: "space-between",
        alignItems: "center",
        gap: 2,
        minHeight: 54,
        cursor: "pointer",
        borderBottom: divider ? 1 : 0,
        borderColor: "divider",
      }}
    >
      <Typography component="span" variant="body" sx={{ whiteSpace: "nowrap" }}>
        {label}
      </Typography>
      <Switch
        checked={checked}
        onChange={(_, next) => onChange(next)}
        slotProps={{ input: { "aria-label": label } }}
      />
    </Stack>
  );
}

// Fractional grid rows animate content height without a fixed-height scroller.
// Disable hidden controls immediately while the visual exit completes.
function AnimatedControl({ show, children, ...props }) {
  return (
    <Box
      {...props}
      inert={!show ? true : undefined}
      aria-hidden={!show ? true : undefined}
      sx={{
        display: "grid",
        minWidth: 0,
        gridTemplateRows: show ? "1fr" : "0fr",
        opacity: show ? 1 : 0,
        visibility: show ? "visible" : "hidden",
        pointerEvents: show ? "auto" : "none",
        transition: `grid-template-rows ${MOTION}, opacity ${MOTION}, visibility 0s linear`,
        transitionDelay: show ? "0ms, 0ms, 0ms" : "0ms, 0ms, 220ms",
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
          transitionDelay: "0ms",
        },
      }}
    >
      <Box sx={{ minHeight: 0, minWidth: 0, overflow: "clip" }}>{children}</Box>
    </Box>
  );
}

export const SharedControls = memo(function SharedControls({
  value,
  onChange,
  selectedRack = null,
}) {
  const id = useId();
  const showAll = selectedRack !== "mgx";
  const setToggle = (key, checked) =>
    onChange({ ...value, [key]: checked }, { key, value: checked });

  return (
    <Box
      component="section"
      aria-labelledby={`${id}-shared`}
      sx={{ borderTop: 1, borderColor: "divider", pt: { xs: 3, md: 3.5 } }}
    >
      <Typography
        id={`${id}-shared`}
        component="h2"
        variant="overline"
        color="text.secondary"
        sx={{ display: "block", mb: 2.5 }}
      >
        Accessories
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: showAll
              ? "minmax(0, 1fr) minmax(0, 1fr)"
              : "minmax(0, 1fr) minmax(0, 0fr)",
          },
          alignItems: "start",
          gap: showAll ? { xs: 2, md: 3 } : 0,
          minWidth: 0,
          transition: `grid-template-columns ${MOTION}, gap ${MOTION}`,
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        <Box role="group" aria-labelledby={`${id}-pdu`} sx={cardStyles}>
          <ControlHeading id={`${id}-pdu`} icon={<Plug strokeWidth={1.75} />}>
            PDU
          </ControlHeading>
          <AnimatedControl show={showAll}>
            <SwitchRow
              label="RPDU"
              checked={value.rpdu}
              onChange={(checked) => setToggle("rpdu", checked)}
              divider
            />
          </AnimatedControl>
          <SwitchRow
            label="Manifolds"
            checked={value.manifolds}
            onChange={(checked) => setToggle("manifolds", checked)}
          />
        </Box>

        <AnimatedControl show={showAll}>
          <Box role="group" aria-labelledby={`${id}-cooling`} sx={cardStyles}>
            <ControlHeading
              id={`${id}-cooling`}
              icon={<Snowflake strokeWidth={1.75} />}
            >
              Cooling
            </ControlHeading>
            <SwitchRow
              label="Heat exchanger"
              checked={value.heatExchanger}
              onChange={(checked) => setToggle("heatExchanger", checked)}
            />
          </Box>
        </AnimatedControl>
      </Box>
    </Box>
  );
});

export default SharedControls;
