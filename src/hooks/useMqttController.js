"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildCommandRequest, createRackCommand, describeRackCommand } from "@/lib/mqtt/commands";

const QUEUE_LIMIT = 32;
const MAX_QUEUE_AGE_MS = 30000;
const COMMAND_TIMEOUT_MS = 25000;
const STATUS_TIMEOUT_MS = 15000;
const STATUS_POLL_MS = 30000;
const CONNECTION_STATES = new Set([
  "connecting", "connected", "disconnected", "unconfigured", "disabled",
]);
const NON_RETRYABLE_CODES = new Set([
  "INVALID_COMMAND", "ORIGIN_NOT_ALLOWED", "INVALID_CONTENT_TYPE",
  "BODY_TOO_LARGE", "COMMAND_QUEUE_EXPIRED",
]);

// Log only validated commands. JSON text preserves the exact payload in DevTools.
function logCommand(stage, command, level = "info", details = {}) {
  console[level](
    `[MQTT] ${stage}: ${describeRackCommand(command)} | ${buildCommandRequest(command).body}`,
    { commandId: command.commandId, ...details },
  );
}

function checkedTime(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : new Date().toISOString();
}

function statusMessage(state) {
  switch (state) {
    case "connected": return "Broker connection verified. Each command checks again before sending.";
    case "unconfigured": return "Configure the MQTT server environment variables.";
    case "disabled": return "MQTT publishing is disabled in the server configuration.";
    case "connecting": return "Checking the broker connection…";
    default: return "The broker could not be reached. Check the connection before trying again.";
  }
}

/**
 * A successful probe describes the last check, not a persistent browser connection.
 * Each POST independently connects, publishes and waits for broker acknowledgement.
 */
export function useMqttController() {
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [isChecking, setIsChecking] = useState(true);
  const [checkedAt, setCheckedAt] = useState(null);
  const [connectionMessage, setConnectionMessage] = useState(statusMessage("connecting"));
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

  const cancelStatusCheck = useCallback(() => {
    ++statusVersion.current;
    const request = statusRequest.current;
    statusRequest.current = null;
    if (request) {
      window.clearTimeout(request.timer);
      request.controller.abort();
    }
    if (mounted.current) setIsChecking(false);
  }, []);

  const refreshStatus = useCallback(async ({ foreground = false } = {}) => {
    if (!mounted.current || document.hidden || statusRequest.current
      || draining.current || active.current || queue.current.length) return null;

    const generation = lifecycle.current;
    const version = ++statusVersion.current;
    const controller = new AbortController();
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, STATUS_TIMEOUT_MS);
    statusRequest.current = { controller, timer };
    setIsChecking(true);
    if (foreground) {
      setConnectionStatus("connecting");
      setConnectionMessage(statusMessage("connecting"));
    }

    try {
      const response = await fetch("/api/mqtt/status", {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("status");
      const result = await response.json();
      if (!CONNECTION_STATES.has(result.state)) throw new Error("status");
      if (!mounted.current || generation !== lifecycle.current || version !== statusVersion.current) return null;

      setConnectionStatus(result.state);
      setCheckedAt(checkedTime(result.checkedAt));
      setConnectionMessage(typeof result.message === "string"
        ? result.message.slice(0, 300)
        : statusMessage(result.state));
      return result;
    } catch {
      if (mounted.current && generation === lifecycle.current && version === statusVersion.current
        && (!controller.signal.aborted || timedOut)) {
        setConnectionStatus("disconnected");
        setCheckedAt(new Date().toISOString());
        setConnectionMessage(timedOut
          ? "The connection check timed out. Try checking the connection again."
          : "The connection check could not be completed. Check your network and try again.");
      }
      return null;
    } finally {
      window.clearTimeout(timer);
      if (statusRequest.current?.controller === controller) {
        statusRequest.current = null;
        if (mounted.current && generation === lifecycle.current) setIsChecking(false);
      }
    }
  }, []);

  const checkConnection = useCallback(() => refreshStatus({ foreground: true }), [refreshStatus]);

  const drain = useCallback(async () => {
    if (draining.current || !mounted.current) return;
    draining.current = true;
    const generation = lifecycle.current;
    // A probe in another request must never overwrite a newer command result.
    cancelStatusCheck();

    try {
      while (mounted.current && generation === lifecycle.current && queue.current.length) {
        const item = queue.current.shift();
        let failed = false;

        const reportFailure = (message, code, delivery) => {
          if (!mounted.current || generation !== lifecycle.current) return;
          failed = true;
          ++statusVersion.current;
          const cancelledCount = queue.current.length;
          for (const queued of queue.current) {
            logCommand("Cancelled", queued.command, "warn", {
              code: "PREVIOUS_COMMAND_FAILED", delivery: "not-sent",
            });
          }
          queue.current = [];
          const canRetry = delivery === "not-sent"
            && !NON_RETRYABLE_CODES.has(code)
            && item.intent === latestIntent.current
            && cancelledCount === 0;
          retryable.current = canRetry ? item : null;
          const cancellation = cancelledCount
            ? ` ${cancelledCount} later queued command${cancelledCount === 1 ? " was" : "s were"} cancelled. Select those options again after checking the connection.`
            : "";
          logCommand(delivery === "unknown" ? "Delivery unknown" : "Not sent", item.command,
            delivery === "unknown" ? "warn" : "error", { code, delivery, cancelledCount });
          setError({
            commandId: item.command.commandId,
            description: item.label,
            message: message + cancellation,
            code,
            delivery,
            canRetry,
            cancelledCount,
          });
          setCheckedAt(new Date().toISOString());
          setConnectionMessage(message);
          if (code === "MQTT_NOT_CONFIGURED" || code === "INVALID_MQTT_CONFIG") setConnectionStatus("unconfigured");
          else if (code === "MQTT_DISABLED") setConnectionStatus("disabled");
          else if (code.startsWith("MQTT_") || code.startsWith("COMMAND_REQUEST_")) setConnectionStatus("disconnected");
        };

        if (Date.now() - item.enqueuedAt > MAX_QUEUE_AGE_MS) {
          reportFailure("This queued command expired and was not sent. Select the option again.", "COMMAND_QUEUE_EXPIRED", "not-sent");
          setPendingCount(0);
          break;
        }

        const controller = new AbortController();
        let timedOut = false;
        const timer = window.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, COMMAND_TIMEOUT_MS);
        active.current = { item, controller, timer };
        ++statusVersion.current;
        setPendingCount(queue.current.length + 1);

        try {
          const request = buildCommandRequest(item.command);
          logCommand("Sending API request", item.command);
          const response = await fetch("/api/mqtt/commands", {
            method: "POST",
            ...request,
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          });
          const result = await response.json();
          if (!mounted.current || generation !== lifecycle.current) break;

          if (response.ok && result.ok === true && result.commandId === item.command.commandId
            && result.delivery === "broker-acknowledged") {
            // Broker receipt is not confirmation that Unreal applied the command.
            logCommand("Broker acknowledged", item.command, "info", { delivery: result.delivery });
            setLastDelivery({ commandId: item.command.commandId, label: item.label, delivery: result.delivery });
            ++statusVersion.current;
            setConnectionStatus("connected");
            setCheckedAt(checkedTime(result.checkedAt));
            setConnectionMessage("Broker acknowledged the command. Unreal application status is not reported.");
          } else {
            const delivery = result.delivery === "not-sent" ? "not-sent" : "unknown";
            const message = typeof result.message === "string"
              ? result.message.slice(0, 300)
              : "The command request could not be confirmed.";
            reportFailure(
              delivery === "unknown" ? `${message} Check the Unreal scene before selecting the option again.` : message,
              typeof result.code === "string" ? result.code : "COMMAND_REQUEST_FAILED",
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
        if (failed) break;
      }
    } finally {
      if (generation === lifecycle.current) draining.current = false;
    }
  }, [cancelStatusCheck]);

  const publishCommand = useCallback((fields) => {
    if (!mounted.current) return null;
    const intent = ++latestIntent.current;
    retryable.current = null;
    let command;
    try {
      command = createRackCommand(fields);
    } catch {
      console.warn("[MQTT] Not queued: invalid configuration command.");
      setError({ message: "This configuration command is invalid.", code: "INVALID_COMMAND", delivery: "not-sent", canRetry: false });
      return null;
    }

    if (queue.current.length + (active.current ? 1 : 0) >= QUEUE_LIMIT) {
      logCommand("Not queued", command, "warn", { code: "COMMAND_QUEUE_FULL", delivery: "not-sent" });
      setError({
        commandId: command.commandId,
        description: describeRackCommand(command),
        message: "Too many commands are waiting. This click was not sent; wait for pending commands, then select it again.",
        code: "COMMAND_QUEUE_FULL",
        delivery: "not-sent",
        canRetry: false,
      });
      return null;
    }

    setError(null);
    queue.current.push({ command, label: describeRackCommand(command), intent, enqueuedAt: Date.now() });
    logCommand("Click queued", command);
    setPendingCount(queue.current.length + (active.current ? 1 : 0));
    void drain();
    return command.commandId;
  }, [drain]);

  const retryLastCommand = useCallback(() => {
    const item = retryable.current;
    if (!mounted.current || !item || item.intent !== latestIntent.current) return null;
    if (queue.current.length || active.current || draining.current) return null;
    retryable.current = null;
    setError(null);
    // An explicit retry refreshes its queue age but preserves its deduplication ID.
    queue.current.push({ ...item, enqueuedAt: Date.now() });
    logCommand("Retry queued", item.command);
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
    void refreshStatus({ foreground: true });
    const poll = window.setInterval(() => { void refreshStatus(); }, STATUS_POLL_MS);
    const onVisibilityChange = () => {
      if (!document.hidden) void refreshStatus({ foreground: true });
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
    connectionStatus, isChecking, checkedAt, connectionMessage,
    pendingCount, lastDelivery, error,
    publishCommand, retryLastCommand, clearError, checkConnection,
  };
}

export default useMqttController;
