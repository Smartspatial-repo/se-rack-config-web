"use client";

import Image from "next/image";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Monitor } from "lucide-react";
import Container from "@mui/material/Container";
import { alpha } from "@mui/material/styles";

const connectionLabels = {
  preview: "UI preview",
  connecting: "Connecting MQTT",
  connected: "MQTT connected",
  disconnected: "MQTT unavailable",
  unconfigured: "MQTT setup required",
  disabled: "MQTT disabled",
};


export function RackHeader({ screenLabel = "Screen 01", connectionStatus = "preview" } = {}) {
  return (
    <Box component="header" sx={(theme) => ({ position: "sticky", top: 0, zIndex: theme.zIndex.appBar, borderBottom: 1, borderColor: "divider", bgcolor: alpha(theme.palette.background.default, 0.92), backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: `0 8px 28px ${alpha(theme.palette.background.default, 0.22)}` })}>
      <Container variant="custom" maxWidth={false}>
        <Stack
          direction="row"
          useFlexGap
          sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: { xs: 3, md: 5 }, rowGap: 2.5, minHeight: { xs: 100, md: 112 }, py: { xs: 2.5, md: 3 } }}
        >
          <Stack direction="row" spacing={{ xs: 2.5, md: 4 }} sx={{ alignItems: "center" }}>
            <Box sx={{ width: { xs: 150, sm: 195 }, flexShrink: 0 }}>
              <Image
                src="/brand/smartspatial-logo.png"
                alt="Smartspatial — Operational Digital Twins"
                width={500}
                height={120}
                priority
                sizes="(max-width: 600px) 150px, 195px"
                style={{ display: "block", width: "100%", height: "auto" }}
              />
            </Box>
            <Box sx={{ borderLeft: 1, borderColor: "divider", pl: { xs: 2.5, md: 4 }, py: 0.5 }}>
              <Typography component="p" variant="subheading" sx={{ whiteSpace: "nowrap" }}>SE Rack</Typography>
              <Typography component="p" variant="caption" color="text.secondary">Remote control</Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={{ xs: 3, sm: 4 }} sx={{ alignItems: "center", width: { xs: "100%", sm: "auto" } }}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", py: 1.25, px: 1.75, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}>
              <Box component={Monitor} size={21} strokeWidth={1.75} aria-hidden="true" sx={{ color: "text.secondary", flexShrink: 0 }} />
              <Typography variant="body2" component="span">{screenLabel}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} role="status" aria-live="polite" sx={{ alignItems: "center" }}>
              <Box aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: connectionStatus === "connected" ? "success.main" : connectionStatus === "connecting" ? "warning.main" : "text.disabled" }} />
              <Typography variant="caption" color="text.secondary">{connectionLabels[connectionStatus] ?? "MQTT disconnected"}</Typography>
            </Stack>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

export default RackHeader;
