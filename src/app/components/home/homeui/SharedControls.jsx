"use client";

import { memo, useId } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import { Eye, EyeOff, Plug, Snowflake } from "lucide-react";
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

function SwitchRow({
  label,
  checked,
  onChange,
  divider = false,
  description,
  disabled = false,
}) {
  const descriptionId = useId();
  return (
    <Stack
      component="label"
      direction="row"
      sx={{
        justifyContent: "space-between",
        alignItems: "center",
        gap: 2,
        minHeight: 54,
        cursor: disabled ? "default" : "pointer",
        borderBottom: divider ? 1 : 0,
        borderColor: "divider",
      }}
    >
      <Box component="span" sx={{ minWidth: 0, py: 1 }}>
        <Typography component="span" variant="body">
          {label}
        </Typography>
        {description && (
          <Typography
            component="span"
            id={descriptionId}
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.5 }}
          >
            {description}
          </Typography>
        )}
      </Box>
      <Switch
        checked={checked}
        disabled={disabled}
        onChange={(_, next) => onChange(next)}
        slotProps={{
          input: {
            role: "switch",
            "aria-label": label,
            "aria-describedby": description ? descriptionId : undefined,
          },
        }}
        sx={{ flexShrink: 0 }}
      />
    </Stack>
  );
}

function VisibilityRow({ hidden, onChange, disabled = false }) {
  return (
    <ToggleButtonGroup
      exclusive
      value={hidden ? "hidden" : "visible"}
      sx={(theme) => ({
        width: "100%",
        "& .MuiToggleButton-root": {
          position: "relative",
          zIndex: 0,
          flex: 1,
          minHeight: 42,
          gap: 0.75,
          textTransform: "none",
          color: "text.secondary",
          borderColor: "divider",
          transition: theme.transitions.create(
            ["background-color", "border-color", "color"],
            { duration: 120 },
          ),
          "&.Mui-selected": {
            zIndex: 1,
            borderColor: "primary.main",
            color: "primary.main",
            backgroundColor: alpha(theme.palette.primary.main, 0.12),
            "&:hover": {
              backgroundColor: alpha(theme.palette.primary.main, 0.18),
            },
          },
        },
      })}
    >
      <ToggleButton
        value="hidden"
        disabled={disabled}
        onClick={() => onChange(true)}
      >
        <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />
        Hide
      </ToggleButton>
      <ToggleButton
        value="visible"
        disabled={disabled}
        onClick={() => onChange(false)}
      >
        <Eye size={16} strokeWidth={1.75} aria-hidden="true" />
        Unhide
      </ToggleButton>
    </ToggleButtonGroup>
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
  cduEnabled = false,
  onCduChange,
  busy = false,
}) {
  const id = useId();
  const showAll = selectedRack !== "mgx";
  const showCdu = selectedRack === "advanced-sx";
  const showHighlighter = selectedRack === "advanced-sx";
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
              : "minmax(0, 0fr) minmax(0, 1fr)",
          },
          alignItems: "start",
          gap: showAll ? { xs: 2, md: 3 } : 0,
          minWidth: 0,
          transition: `grid-template-columns ${MOTION}, gap ${MOTION}`,
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        <AnimatedControl show={showAll}>
          <Box role="group" aria-labelledby={`${id}-power`} sx={cardStyles}>
            <ControlHeading
              id={`${id}-power`}
              icon={<Plug strokeWidth={1.75} />}
            >
              POWER
            </ControlHeading>
            <SwitchRow
              label="rPDU"
              checked={value.rpdu}
              onChange={(checked) => setToggle("rpdu", checked)}
              disabled={busy || !showAll}
            />
          </Box>
        </AnimatedControl>

        <Box role="group" aria-labelledby={`${id}-cooling`} sx={cardStyles}>
          <ControlHeading
            id={`${id}-cooling`}
            icon={<Snowflake strokeWidth={1.75} />}
          >
            Cooling
          </ControlHeading>
          <AnimatedControl show={showAll}>
            <SwitchRow
              label="Rear Door Heat Exchanger"
              checked={value.heatExchanger}
              onChange={(checked) => setToggle("heatExchanger", checked)}
              disabled={busy || !showAll}
              divider
            />
          </AnimatedControl>
          <SwitchRow
            label="Manifolds"
            checked={value.manifolds}
            onChange={(checked) => setToggle("manifolds", checked)}
            disabled={busy}
            divider={showCdu}
          />
          <AnimatedControl show={showCdu}>
            <SwitchRow
              label="In-rack CDU"
              checked={cduEnabled}
              onChange={onCduChange}
              disabled={busy || !showCdu || !onCduChange}
              description={
                cduEnabled
                  ? "Occupies U01–U04. Turn off to free these slots."
                  : "Turning on In-rack CDU replaces equipment overlapping U01–U04."
              }
            />
          </AnimatedControl>
        </Box>
        <AnimatedControl
          show={showHighlighter}
          sx={{
            gridColumn: { xs: "auto", md: "1 / -1" },
          }}
        >
          <Box
            role="group"
            aria-labelledby={`${id}-highlighter`}
            sx={cardStyles}
          >
            <ControlHeading
              id={`${id}-highlighter`}
              icon={<Eye strokeWidth={1.75} />}
            >
              Highlighter visibility
            </ControlHeading>
            <VisibilityRow
              hidden={value.highlightHidden}
              onChange={(hidden) => setToggle("highlightHidden", hidden)}
              disabled={busy || !showHighlighter}
            />
          </Box>
        </AnimatedControl>
      </Box>
    </Box>
  );
});

export default SharedControls;
