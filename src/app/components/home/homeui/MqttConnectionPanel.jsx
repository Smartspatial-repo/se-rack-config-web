"use client";

import { memo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Check, RotateCw, WifiOff } from "lucide-react";
import { alpha } from "@mui/material/styles";

export const MqttConnectionPanel = memo(function MqttConnectionPanel({
  connectionStatus,
  isChecking = false,
  pendingCount = 0,
  connectionMessage,
  checkedAt,
  onRetry,
}) {
  const sending = pendingCount > 0;
  const busy = sending || isChecking;
  const ready = connectionStatus === "connected";
  const accent = busy ? "primary" : ready ? "secondary" : "warning";
  const title = sending
    ? "Connecting & sending"
    : isChecking
      ? "Checking MQTT connection"
      : ready
        ? "Connection verified"
        : connectionStatus === "unconfigured"
          ? "MQTT setup required"
          : connectionStatus === "disabled"
            ? "MQTT publishing is disabled"
            : "MQTT connection unavailable";

  const description = sending
    ? "Verifying the broker connection and waiting for message acknowledgement."
    : isChecking
      ? "Checking your broker. Controls will be ready when the check completes."
      : ready
        ? "Ready to send commands."
        : connectionMessage || "Check your connection and try again.";

  return (
    <Box
      sx={(theme) => ({
        position: "relative",
        minHeight: 90,
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexWrap: { xs: "wrap", sm: "nowrap" },
        px: { xs: 2, sm: 2.5 },
        py: 2,
        border: "1px solid",
        borderColor: alpha(theme.palette[accent].main, 0.25),
        borderRadius: 1.25,
        backgroundColor: alpha(theme.palette.background.paper, 0.92),
        backgroundImage: `linear-gradient(110deg, ${alpha(theme.palette[accent].main, 0.055)}, transparent 65%)`,
        boxShadow: `inset 0 1px 0 ${alpha(theme.palette.text.primary, 0.035)}`,
      })}
    >
      <Box
        aria-hidden="true"
        sx={(theme) => ({
          position: "relative",
          width: 42,
          height: 42,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          borderRadius: "50%",
          color: `${accent}.main`,
          bgcolor: alpha(theme.palette[accent].main, 0.07),
          border: `1px solid ${alpha(theme.palette[accent].main, 0.12)}`,
        })}
      >
        {busy ? (
          <CircularProgress
            size={23}
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
        ) : ready ? <Check size={21} strokeWidth={1.75} /> : <WifiOff size={20} strokeWidth={1.5} />}
      </Box>

      <Box role="status" aria-live="polite" aria-atomic="true" sx={{ flex: 1, minWidth: 160 }}>
        <Typography component="p" variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          {title}
        </Typography>
        <Typography component="p" variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          {description}
        </Typography>
      </Box>

      <Stack sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" }, alignItems: { xs: "flex-start", sm: "flex-end" } }}>
        {!busy && !ready ? (
          <Button
            size="small"
            variant="outlined"
            onClick={onRetry}
            startIcon={<RotateCw size={15} aria-hidden="true" />}
            sx={{ minHeight: 36, color: "text.primary", borderColor: "divider" }}
          >
            Check connection
          </Button>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {sending ? `${pendingCount} pending` : isChecking ? "Please wait…" : checkedAt ? "Broker check passed" : "Ready"}
          </Typography>
        )}
      </Stack>
    </Box>
  );
});

export default MqttConnectionPanel;
