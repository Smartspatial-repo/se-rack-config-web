"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import { X } from "lucide-react";
import HomeUi from "../homeui/HomeUi";
import { DEFAULT_RACK, DEFAULT_SHARED_CONTROLS } from "../homeui/constants";
import MqttConnectionToast from "../homeui/MqttConnectionToast";
import useMqttController from "@/hooks/useMqttController";

const startupCommands = [
  { type: "rack.view.set", view: DEFAULT_SHARED_CONTROLS.rackView },
  { type: "rack.visibility.set", hidden: DEFAULT_SHARED_CONTROLS.rackHidden },
  {
    type: "advanced-sx.cdu.set",
    enabled: DEFAULT_SHARED_CONTROLS.highlightHidden,
  },
  { type: "rack.select", rack: DEFAULT_RACK },
];

export const HomeMain = () => {
  const {
    connectionStatus,
    pendingCount,
    lastDelivery,
    error,
    isChecking,
    connectionMessage,
    checkConnection,
    publishCommand,
    publishCamera,
    retryLastCommand,
    clearError,
  } = useMqttController();
  const [startupIndex, setStartupIndex] = useState(0);
  const [startupFailed, setStartupFailed] = useState(false);
  const startupAttempt = useRef(null);
  const connected = connectionStatus === "connected" && !isChecking;
  const startupComplete = startupIndex === startupCommands.length;

  useEffect(() => {
    if (!connected || startupComplete) return;
    let observing = true;
    setStartupFailed(false);
    // Reuse the same acknowledgement if React reattaches this effect, or
    // if an ACK and disconnect arrive together before the index is committed.
    if (startupAttempt.current?.index !== startupIndex) {
      const ack = Promise.resolve(
        publishCommand(startupCommands[startupIndex], { waitForAck: true }),
      );
      startupAttempt.current = { index: startupIndex, ack };
    }
    const attempt = startupAttempt.current;
    function onSettled(confirmed) {
      if (!confirmed && startupAttempt.current === attempt)
        startupAttempt.current = null;
      if (!observing) return;
      if (confirmed) setStartupIndex(startupIndex + 1);
      else setStartupFailed(true);
    }
    attempt.ack.then(onSettled, () => onSettled(false));
    return () => {
      observing = false;
    };
  }, [connected, publishCommand, startupComplete, startupIndex]);

  const onRackSelect = useCallback(
    (rack) => {
      return publishCommand(
        { type: "rack.select", rack },
        { waitForAck: true },
      );
    },
    [publishCommand],
  );
  const onSystemSelect = useCallback(
    (model) => {
      return publishCommand(
        { type: "mgx.model.select", model },
        { waitForAck: true },
      );
    },
    [publishCommand],
  );
  const onSlotSelect = useCallback(
    (slotId) => {
      return publishCommand(
        { type: "advanced-sx.slot.focus", slotId },
        { waitForAck: true },
      );
    },
    [publishCommand],
  );
  const onSlotChange = useCallback(
    (slotId, equipmentId) => {
      return publishCommand(
        { type: "advanced-sx.slot.set", slotId, equipmentId },
        { waitForAck: true },
      );
    },
    [publishCommand],
  );
  const onCduChange = useCallback(
    (enabled) => {
      return publishCommand(
        { type: "rack.highlight.set", hidden: enabled },
        { waitForAck: true },
      );
    },
    [publishCommand],
  );
  const onControlsChange = useCallback(
    (_next, change) => {
      if (!change) return;
      if (change.key === "rackView")
        publishCommand({ type: "rack.view.set", view: change.value });
      else if (change.key === "rackHidden")
        publishCommand({ type: "rack.visibility.set", hidden: change.value });
      else if (change.key === "highlightHidden")
        publishCommand({ type: "advanced-sx.cdu.set", enabled: change.value });
      else
        return publishCommand(
          {
            type: "accessory.set",
            accessory: change.key,
            enabled: change.value,
          },
          { waitForAck: true },
        );
    },
    [publishCommand],
  );

  const mqttFeedback = pendingCount
    ? `Waiting for ${pendingCount} broker acknowledgement${pendingCount === 1 ? "" : "s"}`
    : error
      ? error.delivery === "unknown"
        ? "Delivery unknown — check Unreal before repeating the action."
        : "Command not sent — review the connection message."
      : lastDelivery
        ? `Broker acknowledged: ${lastDelivery.label}`
        : "";

  return (
    <>
      <MqttConnectionToast
        connectionStatus={connectionStatus}
        startupStatus={
          startupComplete ? "ready" : startupFailed ? "failed" : "applying"
        }
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
        onCduChange={onCduChange}
        onControlsChange={onControlsChange}
        onCameraChange={publishCamera}
        mqttFeedback={mqttFeedback}
        controlsDisabled={!connected || !startupComplete}
      />
      <Snackbar
        open={Boolean(error)}
        onClose={(_event, reason) => {
          if (reason !== "clickaway") clearError();
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={error?.delivery === "unknown" ? "warning" : "error"}
          variant="filled"
          action={
            <Stack direction="row" sx={{ alignItems: "center" }}>
              {error?.canRetry && (
                <Button
                  color="inherit"
                  size="small"
                  onClick={retryLastCommand}
                  disabled={connectionStatus !== "connected" || isChecking}
                >
                  Retry command
                </Button>
              )}
              <IconButton
                color="inherit"
                size="small"
                onClick={clearError}
                aria-label="Dismiss MQTT message"
              >
                <X size={18} aria-hidden="true" />
              </IconButton>
            </Stack>
          }
        >
          {error?.message}
        </Alert>
      </Snackbar>
    </>
  );
};
