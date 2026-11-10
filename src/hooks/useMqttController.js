"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildMqttPayload, createRackCommand, describeRackCommand } from "@/lib/mqtt/commands";
import { createBrowserMqttClient } from "@/lib/mqtt/browserClient";

const SETUP_TIMEOUT_MS = 15000;

function logCommand(stage, command, level = "info", details = {}) {
  console[level](
    "[MQTT] " + stage + ": " + describeRackCommand(command) + " | "
      + JSON.stringify(buildMqttPayload(command, { format: "location" })),
    { commandId: command.commandId, ...details },
  );
}

/** One MQTT WebSocket for this mounted controller; clicks never call the commands API. */
export function useMqttController() {
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [isChecking, setIsChecking] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState("Connecting to your rack…");
  const [checkedAt, setCheckedAt] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastDelivery, setLastDelivery] = useState(null);
  const [error, setError] = useState(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const transport = useRef(null);
  const setupRequest = useRef(null);
  const attempts = useRef(new Map());
  const acknowledgements = useRef(new Map());
  const latestCommandId = useRef(null);
  const retryable = useRef(null);
  const lastCameraLog = useRef(-Infinity);

  const reportCommandError = useCallback((event) => {
    if (!mounted.current) return;
    const acknowledge = acknowledgements.current.get(event.commandId);
    acknowledgements.current.delete(event.commandId);
    acknowledge?.(false);
    const command = attempts.current.get(event.commandId);
    if (event.commandId) attempts.current.delete(event.commandId);
    if (!command) return; // Connection errors are displayed by the connection panel.
    // Retry a compound edit from its inspector so every prerequisite is checked again.
    const canRetry = !acknowledge && event.delivery === "not-sent"
      && latestCommandId.current === command.commandId
      && event.code !== "INVALID_COMMAND";
    retryable.current = canRetry ? command : null;
    logCommand(event.delivery === "unknown" ? "Delivery unknown" : "Not sent", command,
      event.delivery === "unknown" ? "warn" : "error", {
        code: event.code, delivery: event.delivery,
      });
    setError({
      ...event,
      description: describeRackCommand(command),
      canRetry,
    });
  }, []);

  const checkConnection = useCallback(async () => {
    if (!mounted.current) return;
    const current = ++generation.current;
    if (setupRequest.current) {
      clearTimeout(setupRequest.current.timer);
      setupRequest.current.controller.abort();
      setupRequest.current = null;
    }
    // A manual reconnect must not silently resend requests already in flight.
    for (const command of [...attempts.current.values()]) {
      reportCommandError({
        commandId: command.commandId,
        code: "MQTT_RECONNECT_REQUESTED",
        delivery: "unknown",
        message: "The connection was restarted before acknowledgement. Check Unreal before repeating the action.",
      });
    }
    transport.current?.stop();
    transport.current = null;
    setPendingCount(0);
    setConnectionStatus("connecting");
    setIsChecking(true);
    setConnectionMessage("Loading connection settings…");

    const controller = new AbortController();
    let timer;
    let timedOut = false;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new Error("SETUP_TIMEOUT"));
      }, SETUP_TIMEOUT_MS);
    });
    setupRequest.current = { controller, timer };
    const isCurrent = () => mounted.current && generation.current === current;

    try {
      const [result, mqttModule] = await Promise.race([
        Promise.all([
          fetch("/api/mqtt/browser-config", {
            cache: "no-store", credentials: "same-origin", signal: controller.signal,
          }).then(async (response) => {
            if (!response.ok) throw new Error("CONFIG_REQUEST_FAILED");
            return response.json();
          }),
          import("mqtt"),
        ]),
        timeout,
      ]);
      if (!isCurrent()) return;
      if (result.state !== "ready" || !result.config) {
        const state = result.state === "disabled" ? "disabled" : "unconfigured";
        setConnectionStatus(state);
        setIsChecking(false);
        setConnectionMessage(typeof result.message === "string"
          ? result.message.slice(0, 300) : "Configure the browser MQTT connection settings.");
        return;
      }
      const connect = mqttModule.connect ?? mqttModule.default?.connect;
      if (typeof connect !== "function") throw new Error("MQTT_MODULE_UNAVAILABLE");

      const client = createBrowserMqttClient({
        connect,
        onState: (state) => {
          if (!isCurrent()) return;
          setConnectionStatus(state.state);
          setIsChecking(state.state === "connecting");
          setConnectionMessage(state.message);
          if (state.state === "connected") {
            lastCameraLog.current = -Infinity;
            setCheckedAt(new Date().toISOString());
            console.info("[MQTT] Connected over WebSocket. Ready for commands.");
          } else if (state.state === "disconnected") {
            console.warn("[MQTT] Connection unavailable.", { code: state.code });
          }
        },
        onPending: (count) => { if (isCurrent()) setPendingCount(count); },
        onDelivery: (delivery) => {
          if (!isCurrent()) return;
          const acknowledge = acknowledgements.current.get(delivery.commandId);
          acknowledgements.current.delete(delivery.commandId);
          acknowledge?.(true);
          const command = attempts.current.get(delivery.commandId);
          attempts.current.delete(delivery.commandId);
          if (!command) return;
          logCommand("Broker acknowledged", command, "info", { delivery: delivery.delivery });
          setLastDelivery({ ...delivery, label: describeRackCommand(command) });
        },
        onError: (event) => { if (isCurrent()) reportCommandError(event); },
        onCameraPublish: (payload) => {
          if (!isCurrent()) return;
          const now = Date.now();
          if (payload.phase === "end" || now - lastCameraLog.current >= 1000) {
            lastCameraLog.current = now;
            console.info("[MQTT] Camera handed to transport (QoS 0; no application acknowledgement) | " + JSON.stringify(payload));
          }
        },
      });
      transport.current = client;
      client.start(result.config);
    } catch {
      if (isCurrent() && (!controller.signal.aborted || timedOut)) {
        setConnectionStatus("disconnected");
        setIsChecking(false);
        setConnectionMessage(timedOut
          ? "Connection setup timed out. Try connecting again."
          : "Connection settings or the MQTT client could not be loaded. Try connecting again.");
        console.warn("[MQTT] Connection setup failed.", {
          code: timedOut ? "MQTT_SETUP_TIMEOUT" : "MQTT_SETUP_FAILED",
        });
      }
    } finally {
      clearTimeout(timer);
      if (setupRequest.current?.controller === controller) setupRequest.current = null;
    }
  }, [reportCommandError]);

  const sendCommand = useCallback((command, stage) => {
    retryable.current = null;
    latestCommandId.current = command.commandId;
    setError(null);
    attempts.current.set(command.commandId, command);
    logCommand(stage, command);
    if (!transport.current) {
      reportCommandError({
        commandId: command.commandId, code: "MQTT_DISCONNECTED", delivery: "not-sent",
        message: "MQTT is not connected. This action was not sent; select it again after connecting.",
      });
      return null;
    }
    // publish() returns immediately. Other controls remain usable while ACKs arrive.
    return transport.current.publish(command) ? command.commandId : null;
  }, [reportCommandError]);

  const publishCommand = useCallback((fields, { waitForAck = false } = {}) => {
    if (!mounted.current) return null;
    let command;
    try {
      command = createRackCommand(fields);
    } catch {
      retryable.current = null;
      latestCommandId.current = null;
      console.warn("[MQTT] Not sent: invalid configuration command.");
      setError({ code: "INVALID_COMMAND", delivery: "not-sent", canRetry: false,
        message: "This configuration command is invalid." });
      return null;
    }
    if (!waitForAck) return sendCommand(command, "Publish requested");
    return new Promise((resolve) => {
      // Register first because a transport refusal can arrive synchronously.
      acknowledgements.current.set(command.commandId, resolve);
      if (!sendCommand(command, "Publish requested")) {
        acknowledgements.current.delete(command.commandId);
        resolve(false);
      }
    });
  }, [sendCommand]);

  const retryLastCommand = useCallback(() => {
    const command = retryable.current;
    if (!mounted.current || !command || command.commandId !== latestCommandId.current) return null;
    return sendCommand(command, "Retry requested");
  }, [sendCommand]);

  // A ref-only fast path: animation frames do not re-render the page or update
  // discrete-command ACK state. The transport coalesces and rate-limits poses.
  const publishCamera = useCallback((snapshot, options) => {
    if (!mounted.current) return false;
    return transport.current?.publishCamera(snapshot, options) ?? false;
  }, []);

  const clearError = useCallback(() => {
    retryable.current = null;
    if (mounted.current) setError(null);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void checkConnection();
    return () => {
      mounted.current = false;
      ++generation.current;
      if (setupRequest.current) {
        clearTimeout(setupRequest.current.timer);
        setupRequest.current.controller.abort();
        setupRequest.current = null;
      }
      transport.current?.stop();
      transport.current = null;
      for (const resolve of acknowledgements.current.values()) resolve(false);
      acknowledgements.current.clear();
      attempts.current.clear();
      retryable.current = null;
    };
  }, [checkConnection]);

  return {
    connectionStatus, isChecking, checkedAt, connectionMessage,
    pendingCount, lastDelivery, error,
    publishCommand, publishCamera, retryLastCommand, clearError, checkConnection,
  };
}

export default useMqttController;
