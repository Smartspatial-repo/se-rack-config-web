"use client";

import { memo, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Slide from "@mui/material/Slide";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { alpha } from "@mui/material/styles";
import { Check, RotateCw, WifiOff } from "lucide-react";

const CONNECTED_DURATION = 3000;

/** Connection feedback is outside document flow and outside the disabled controls. */
export const MqttConnectionToast = memo(function MqttConnectionToast({
  connectionStatus = "connecting",
  startupStatus = "ready",
  isChecking = false,
  connectionMessage,
  onRetry,
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const phase = isChecking || connectionStatus === "connecting"
    ? "connecting"
    : connectionStatus === "connected"
      ? startupStatus === "ready" ? "connected" : startupStatus
      : connectionStatus === "preview" ? "preview" : "unavailable";
  const [open, setOpen] = useState(phase !== "preview");

  useEffect(() => {
    setOpen(phase !== "preview");
    if (phase !== "connected") return undefined;
    const timer = setTimeout(() => setOpen(false), CONNECTED_DURATION);
    return () => clearTimeout(timer);
    // Only a connection-phase change starts a new notification cycle.
    // Command acknowledgements, timestamps and message updates never restart it.
  }, [phase]);

  const connecting = phase === "connecting";
  const connected = phase === "connected";
  const busy = connecting || phase === "applying";
  const accent = busy ? "primary" : connected ? "secondary" : "warning";
  const title = connecting
    ? "Connecting to your rack"
    : phase === "applying" ? "Applying rack defaults"
    : phase === "failed" ? "Rack setup interrupted"
    : connected
      ? "Connected"
      : connectionStatus === "unconfigured"
        ? "MQTT setup required"
        : connectionStatus === "disabled"
          ? "MQTT publishing is disabled"
          : "Connection unavailable";
  const description = connecting
    ? "Your controls will be ready shortly."
    : phase === "applying" ? "Setting Front view, Unhide, and MGX."
    : phase === "failed" ? "Reconnect to finish applying the startup settings."
    : connected
      ? "Your rack controls are ready."
      : connectionMessage || "Check your connection and try again.";

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      slots={{ transition: Slide }}
      slotProps={{ transition: { direction: "down" } }}
      transitionDuration={reducedMotion ? 0 : { enter: 240, exit: 180 }}
      onClose={(_event, reason) => {
        if (connected && reason !== "clickaway") setOpen(false);
      }}
      sx={{
        top: { xs: "max(12px, env(safe-area-inset-top))", sm: 24 },
        left: "50%",
        right: "auto",
        width: "min(540px, calc(100vw - 32px))",
        transform: "translateX(-50%)",
      }}
    >
      <Box
        role="status"
        aria-live="polite"
        aria-atomic="true"
        sx={(theme) => ({
          width: "100%",
          minWidth: 0,
          px: { xs: 2, sm: 2.5 },
          py: 1.75,
          border: "1px solid",
          borderColor: alpha(theme.palette[accent].main, 0.3),
          borderRadius: 1.5,
          backgroundColor: alpha(theme.palette.background.paper, 0.96),
          backdropFilter: "blur(14px)",
          boxShadow: `0 12px 36px ${alpha(theme.palette.background.default, 0.35)}`,
          transition: theme.transitions.create(["border-color", "background-color"], { duration: 180 }),
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        })}
      >
        <Stack
          key={phase}
          direction="row"
          useFlexGap
          sx={{
            alignItems: "center",
            flexWrap: { xs: "wrap", sm: "nowrap" },
            gap: 1.5,
            animation: "mqtt-toast-content-enter 180ms ease-out both",
            "@keyframes mqtt-toast-content-enter": {
              from: { opacity: 0, transform: "translateY(3px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        >
          <Box
            aria-hidden="true"
            sx={(theme) => ({
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              flexShrink: 0,
              borderRadius: "50%",
              color: `${accent}.main`,
              backgroundColor: alpha(theme.palette[accent].main, 0.09),
            })}
          >
            {busy ? (
              <CircularProgress
                size={20}
                thickness={3}
                disableShrink
                color="inherit"
                sx={{
                  "@media (prefers-reduced-motion: reduce)": {
                    animation: "none",
                    "& .MuiCircularProgress-circle": { animation: "none" },
                  },
                }}
              />
            ) : connected ? <Check size={20} strokeWidth={1.75} /> : <WifiOff size={19} strokeWidth={1.75} />}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="p" variant="body2" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            <Typography component="p" variant="caption" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.5, overflowWrap: "anywhere" }}>
              {description}
            </Typography>
          </Box>
          {(phase === "unavailable" || phase === "failed") && onRetry ? (
            <Button
              variant="outlined"
              size="small"
              onClick={onRetry}
              startIcon={<RotateCw size={15} aria-hidden="true" />}
              sx={{ minHeight: 40, flexShrink: 0, width: { xs: "100%", sm: "auto" }, color: "text.primary", borderColor: "divider" }}
            >
              Reconnect
            </Button>
          ) : null}
        </Stack>
      </Box>
    </Snackbar>
  );
});

export default MqttConnectionToast;
