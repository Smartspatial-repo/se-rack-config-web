"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRackCommand, describeRackCommand } from "@/lib/mqtt/commands";

const QUEUE_LIMIT = 32;
const COMMAND_TIMEOUT_MS = 12000;
const STATUS_TIMEOUT_MS = 8000;
const CONNECTION_STATES = new Set([
  "connecting",
  "connected",
  "disconnected",
  "unconfigured",
  "disabled",
]);

/** Sends explicit UI commands only. Broker credentials never reach the browser. */
export function useMqttController() {
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastDelivery, setLastDelivery] = useState(null);
  const [error, setError] = useState(null);
  const mounted = useRef(false);
  const lifecycle = useRef(0);
  const queue = useRef([]);
  const active = useRef(null);
  const draining = useRef(false);
  const latestIntent = useRef(0);
  const retryable = useRef(null);
  const statusRequest = useRef(null);
  const statusVersion = useRef(0);

  const refreshStatus = useCallback(async () => {
    if (!mounted.current || document.hidden || statusRequest.current) return;
    const generation = lifecycle.current;
    const version = ++statusVersion.current;
    const controller = new AbortController();
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, STATUS_TIMEOUT_MS);
    statusRequest.current = { controller, timer };

    try {
      const response = await fetch("/api/mqtt/status", {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("status");
      const result = await response.json();
      if (!CONNECTION_STATES.has(result.state)) throw new Error("status");
      if (
        mounted.current &&
        generation === lifecycle.current &&
        version === statusVersion.current
      ) {
        setConnectionStatus(result.state);
      }
    } catch {
      if (
        mounted.current &&
        generation === lifecycle.current &&
        version === statusVersion.current &&
        (!controller.signal.aborted || timedOut)
      ) {
        setConnectionStatus("disconnected");
      }
    } finally {
      window.clearTimeout(timer);
      if (statusRequest.current?.controller === controller)
        statusRequest.current = null;
    }
  }, []);

  const drain = useCallback(async () => {
    if (draining.current || !mounted.current) return;
    draining.current = true;
    const generation = lifecycle.current;

    try {
      while (
        mounted.current &&
        generation === lifecycle.current &&
        queue.current.length
      ) {
        const item = queue.current.shift();
        const controller = new AbortController();
        let timedOut = false;
        const timer = window.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, COMMAND_TIMEOUT_MS);
        active.current = { item, controller, timer };
        setPendingCount(queue.current.length + 1);

        const reportFailure = (message, code, delivery) => {
          if (!mounted.current || generation !== lifecycle.current) return;
          const canRetry =
            delivery === "not-sent" && item.intent === latestIntent.current;
          retryable.current = canRetry ? item : null;
          setError({
            commandId: item.command.commandId,
            description: item.label,
            message,
            code,
            delivery,
            canRetry,
          });
          if (code === "MQTT_NOT_CONFIGURED")
            setConnectionStatus("unconfigured");
          else if (code === "MQTT_DISABLED") setConnectionStatus("disabled");
          else if (code === "MQTT_DISCONNECTED")
            setConnectionStatus("disconnected");
        };

        try {
          const requestBody = JSON.stringify(item.command);
          console.log("Commands API request:", requestBody);
          const response = await fetch("/api/mqtt/commands", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            cache: "no-store",
            body: requestBody,
            signal: controller.signal,
          });
          const result = await response.json();
          if (!mounted.current || generation !== lifecycle.current) break;

          if (
            response.ok &&
            result.ok === true &&
            result.commandId === item.command.commandId &&
            result.delivery === "broker-acknowledged"
          ) {
            // This confirms broker receipt, not that Unreal applied the command.
            setLastDelivery({
              commandId: item.command.commandId,
              label: item.label,
              delivery: result.delivery,
            });
            ++statusVersion.current;
            setConnectionStatus("connected");
          } else {
            const delivery =
              result.delivery === "not-sent" ? "not-sent" : "unknown";
            const message =
              typeof result.message === "string"
                ? result.message.slice(0, 300)
                : "The command request could not be confirmed.";
            reportFailure(
              delivery === "unknown"
                ? `${message} Check the Unreal scene before selecting the option again.`
                : message,
              typeof result.code === "string"
                ? result.code
                : "COMMAND_REQUEST_FAILED",
              delivery,
            );
          }
        } catch {
          reportFailure(
            timedOut
              ? "The command request timed out. Delivery is unknown; check the Unreal scene before selecting the option again."
              : "The command request could not be confirmed. Delivery is unknown; check the Unreal scene before selecting the option again.",
            timedOut ? "COMMAND_REQUEST_TIMEOUT" : "COMMAND_REQUEST_FAILED",
            "unknown",
          );
        } finally {
          window.clearTimeout(timer);
          if (generation === lifecycle.current) {
            active.current = null;
            if (mounted.current) setPendingCount(queue.current.length);
          }
        }
      }
    } finally {
      if (generation === lifecycle.current) {
        draining.current = false;
        void refreshStatus();
      }
    }
  }, [refreshStatus]);

  const publishCommand = useCallback(
    (fields) => {
      if (!mounted.current) return null;
      let command;
      try {
        command = createRackCommand(fields);
      } catch {
        retryable.current = null;
        setError({
          message: "This configuration command is invalid.",
          code: "INVALID_COMMAND",
          delivery: "not-sent",
          canRetry: false,
        });
        return null;
      }

      const intent = ++latestIntent.current;
      retryable.current = null;
      if (queue.current.length + (active.current ? 1 : 0) >= QUEUE_LIMIT) {
        setError({
          commandId: command.commandId,
          description: describeRackCommand(command),
          message:
            "Too many commands are waiting. This click was not sent; wait for the pending commands, then select it again.",
          code: "COMMAND_QUEUE_FULL",
          delivery: "not-sent",
          canRetry: false,
        });
        return null;
      }

      setError(null);
      queue.current.push({
        command,
        label: describeRackCommand(command),
        intent,
      });
      setPendingCount(queue.current.length + (active.current ? 1 : 0));
      void drain();
      return command.commandId;
    },
    [drain],
  );

  const retryLastCommand = useCallback(() => {
    const item = retryable.current;
    if (!mounted.current || !item || item.intent !== latestIntent.current)
      return null;
    if (queue.current.length || active.current) return null;
    retryable.current = null;
    setError(null);
    // Preserve the ID for server-side deduplication; never retry unknown delivery.
    queue.current.push(item);
    setPendingCount(1);
    void drain();
    return item.command.commandId;
  }, [drain]);

  const clearError = useCallback(() => {
    retryable.current = null;
    if (mounted.current) setError(null);
  }, []);

  useEffect(() => {
    mounted.current = true;
    ++lifecycle.current;
    void refreshStatus();
    const poll = window.setInterval(refreshStatus, 5000);
    const onVisibilityChange = () => {
      if (!document.hidden) void refreshStatus();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mounted.current = false;
      ++lifecycle.current;
      ++statusVersion.current;
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (statusRequest.current) {
        window.clearTimeout(statusRequest.current.timer);
        statusRequest.current.controller.abort();
        statusRequest.current = null;
      }
      if (active.current) {
        window.clearTimeout(active.current.timer);
        active.current.controller.abort();
        active.current = null;
      }
      queue.current = [];
      retryable.current = null;
      draining.current = false;
    };
  }, [refreshStatus]);

  return {
    connectionStatus,
    pendingCount,
    lastDelivery,
    error,
    publishCommand,
    retryLastCommand,
    clearError,
  };
}

export default useMqttController;
