"use client";

import { useCallback } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import { X } from "lucide-react";
import HomeUi from "../homeui/HomeUi";
import MqttConnectionToast from "../homeui/MqttConnectionToast";
import useMqttController from "@/hooks/useMqttController";

export const HomeMain = () => {
  const {
    connectionStatus, pendingCount, lastDelivery, error,
    isChecking, connectionMessage, checkConnection,
    publishCommand, publishCamera, retryLastCommand, clearError,
  } = useMqttController();

  const onRackSelect = useCallback((rack) => {
    publishCommand({ type: "rack.select", rack });
  }, [publishCommand]);
  const onSystemSelect = useCallback((model) => {
    publishCommand({ type: "mgx.model.select", model });
  }, [publishCommand]);
  const onSlotSelect = useCallback((slotId) => {
    publishCommand({ type: "advanced-sx.slot.focus", slotId });
  }, [publishCommand]);
  const onSlotChange = useCallback((slotId, equipmentId) => {
    publishCommand({ type: "advanced-sx.slot.set", slotId, equipmentId });
  }, [publishCommand]);
  const onControlsChange = useCallback((_next, change) => {
    if (!change) return;
    if (change.key === "rackView") publishCommand({ type: "rack.view.set", view: change.value });
    else if (change.key === "rackHidden") publishCommand({ type: "rack.visibility.set", hidden: change.value });
    else if (change.key === "highlightHidden") publishCommand({ type: "rack.highlight.set", hidden: change.value });
    else publishCommand({ type: "accessory.set", accessory: change.key, enabled: change.value });
  }, [publishCommand]);

  const mqttFeedback = pendingCount
    ? `Waiting for ${pendingCount} broker acknowledgement${pendingCount === 1 ? "" : "s"} · controls remain available`
    : error
      ? error.delivery === "unknown" ? "Delivery unknown — check Unreal before repeating the action." : "Command not sent — review the connection message."
      : lastDelivery
        ? `Broker acknowledged: ${lastDelivery.label}`
        : "";

  return (
    <>
      <MqttConnectionToast
        connectionStatus={connectionStatus}
        isChecking={isChecking}
        connectionMessage={connectionMessage}
        onRetry={checkConnection}
      />
      <HomeUi
        connectionStatus={connectionStatus}
        onRackSelect={onRackSelect}
        onSystemSelect={onSystemSelect}
        onSlotSelect={onSlotSelect}
        onSlotChange={onSlotChange}
        onControlsChange={onControlsChange}
        onCameraChange={publishCamera}
        mqttFeedback={mqttFeedback}
        controlsDisabled={connectionStatus !== "connected" || isChecking}
      />
      <Snackbar open={Boolean(error)} onClose={(_event, reason) => { if (reason !== "clickaway") clearError(); }} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert
          severity={error?.delivery === "unknown" ? "warning" : "error"}
          variant="filled"
          action={(
            <Stack direction="row" sx={{ alignItems: "center" }}>
              {error?.canRetry && <Button color="inherit" size="small" onClick={retryLastCommand} disabled={connectionStatus !== "connected" || isChecking}>Retry command</Button>}
              <IconButton color="inherit" size="small" onClick={clearError} aria-label="Dismiss MQTT message"><X size={18} aria-hidden="true" /></IconButton>
            </Stack>
          )}
        >
          {error?.message}
        </Alert>
      </Snackbar>
    </>
  );
}
