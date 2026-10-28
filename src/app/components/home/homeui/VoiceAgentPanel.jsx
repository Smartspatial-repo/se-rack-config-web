"use client";

import { memo, useId } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Mic, PhoneOff } from "lucide-react";
import { alpha } from "@mui/material/styles";
import VoiceOrb from "./VoiceOrb";

const statusLabels = {
  unavailable: "Not connected",
  idle: "Ready",
  listening: "Listening",
  speaking: "Speaking",
};


export const VoiceAgentPanel = memo(function VoiceAgentPanel({ status = "unavailable", transcript = "", audioLevel, onStart, onEnd } = {}) {
  const id = useId();
  const active = status === "listening" || status === "speaking";

  return (
    <Box
      component="section"
      aria-labelledby={id}
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        flexWrap: { xs: "wrap", md: "nowrap" },
        gap: { xs: 2, md: 3 },
        px: { xs: 2.5, sm: 3, md: 4 },
        py: { xs: 2.5, md: 3 },
        border: "1px solid",
        borderColor: alpha(theme.palette.primary.main, 0.28),
        borderRadius: 1.5,
        backgroundColor: alpha(theme.palette.background.paper, 0.78),
      })}
    >
      <Box
        aria-hidden="true"
        sx={{
          flexShrink: 0,
          width: { xs: 88, sm: 108, md: 120 },
          height: { xs: 88, sm: 108, md: 120 },
        }}
      >
        <VoiceOrb status={status} audioLevel={audioLevel} />
      </Box>

      <Box sx={(theme) => ({ flex: 1, minWidth: { xs: 150, md: 0 }, pl: { sm: 2.5, md: 3 }, borderLeft: { sm: `1px solid ${theme.palette.divider}` } })}>
        <Stack direction="row" useFlexGap sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
          <Typography id={id} component="h2" variant="subheading" sx={{ fontSize: { xs: "1rem", md: "1.125rem" } }}>Spatial voice agent</Typography>
          <Typography variant="caption" role="status" aria-live="polite" color={status === "unavailable" ? "text.secondary" : "primary.main"}>{statusLabels[status]}</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }} aria-live={active ? "polite" : "off"}>
          {transcript || (status === "listening" ? "Listening to your request…" : "Configure your rack by voice.")}
        </Typography>
      </Box>

      <Button
        variant="outlined"
        startIcon={active ? <PhoneOff size={20} strokeWidth={1.75} aria-hidden="true" /> : <Mic size={20} strokeWidth={1.75} aria-hidden="true" />}
        onClick={active ? onEnd : onStart}
        disabled={active && !onEnd}
        sx={{
          flexShrink: 0,
          width: { xs: "100%", md: "auto" },
          minWidth: { md: 218 },
          minHeight: 52,
          borderColor: active ? "divider" : "primary.dark",
          color: "text.primary",
          bgcolor: "action.hover",
        }}
      >
        {active ? "End conversation" : "Talk to agent"}
      </Button>
    </Box>
  );
});

export default VoiceAgentPanel;
