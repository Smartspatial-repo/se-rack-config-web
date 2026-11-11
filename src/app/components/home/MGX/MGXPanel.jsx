"use client";

import { memo, useId } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { CircleCheck, Cpu } from "lucide-react";
import { alpha } from "@mui/material/styles";
import { MGX_SYSTEMS } from "../homeui/constants";

export const MGXPanel = memo(function MGXPanel({ value = null, onChange }) {
  const headingId = useId();

  return (
    <Box component="section" aria-labelledby={headingId}>
      <Typography id={headingId} component="h2" variant="h3">
        MGX
      </Typography>
      <Typography variant="body" color="text.secondary" sx={{ mt: 1 }}>
        Choose the system for your MGX rack.
      </Typography>

      <Box
        role="group"
        aria-label="MGX system"
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 2,
          mt: 3,
        }}
      >
        {MGX_SYSTEMS.map((system) => {
          const selected = value === system.id;

          return (
            <ButtonBase
              key={system.id}
              onClick={() => onChange(system.id)}
              aria-label={system.label}
              aria-pressed={selected}
              sx={(theme) => ({
                width: "100%",
                minHeight: { xs: 120, md: 140 },
                display: "flex",
                justifyContent: "flex-start",
                gap: 2,
                p: { xs: 2.5, md: 3 },
                textAlign: "left",
                border: "1px solid",
                borderColor: selected ? "secondary.main" : "divider",
                borderRadius: 1.25,
                backgroundColor: selected
                  ? alpha(theme.palette.secondary.main, 0.12)
                  : alpha(theme.palette.background.paper, 0.72),
                transition: theme.transitions.create(
                  ["background-color", "border-color"],
                  { duration: 120, easing: theme.transitions.easing.easeOut },
                ),
                "&:hover": {
                  borderColor: selected ? "secondary.main" : "primary.dark",
                  backgroundColor: alpha(theme.palette.secondary.main, 0.16),
                },
                "&:active": {
                  backgroundColor: alpha(theme.palette.secondary.main, 0.23),
                  transitionDuration: "0ms",
                },
                "&.Mui-focusVisible": {
                  outline: `2px solid ${theme.palette.primary.light}`,
                  outlineOffset: 4,
                },
              })}
            >
              <Box
                component={Cpu}
                size={30}
                strokeWidth={1.75}
                aria-hidden="true"
                sx={{
                  flexShrink: 0,
                  color: selected ? "secondary.light" : "primary.light",
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  component="span"
                  variant="subheading"
                  sx={{ display: "block" }}
                >
                  {system.label}
                </Typography>
                <Typography
                  component="span"
                  variant="caption"
                  color={selected ? "secondary.light" : "text.secondary"}
                  sx={{ display: "block", mt: 0.75 }}
                >
                  {selected ? "Deselect system" : "Select system"}
                </Typography>
              </Box>
              {selected && (
                <Box
                  component={CircleCheck}
                  size={22}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  sx={{ flexShrink: 0, color: "secondary.main" }}
                />
              )}
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
});

export default MGXPanel;
