// Camera updates are absolute poses, separate from the discrete { location } API.
export const CAMERA_INTERVAL_MS = 50; // At most 20 moving samples/second.
export const CAMERA_MAX_AGE_MS = 250;
export const CAMERA_BUFFER_LIMIT = 16 * 1024;

function vector(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("A camera vector is required.");
  }
  const result = {};
  for (const axis of ["x", "y", "z"]) {
    if (typeof value[axis] !== "number" || !Number.isFinite(value[axis]) || Math.abs(value[axis]) > 100) {
      throw new TypeError("Camera coordinates must be finite and within 100 preview units.");
    }
    result[axis] = value[axis];
  }
  return result;
}

/** Copy caller-owned vectors; later Three.js mutations cannot change a queued pose. */
export function parseCameraSnapshot(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("A camera snapshot is required.");
  }
  const position = vector(input.position);
  const target = vector(input.target);
  const distance = Math.hypot(position.x - target.x, position.y - target.y, position.z - target.z);
  if (distance < 0.1 || distance > 100) throw new TypeError("Invalid camera distance.");
  if (typeof input.fov !== "number" || !Number.isFinite(input.fov) || input.fov < 10 || input.fov > 100) {
    throw new TypeError("Invalid camera vertical field of view.");
  }
  return { position, target, fov: input.fov };
}

function unrealVector({ x, y, z }) {
  // Preview front +Z maps to Unreal +X. Reflect the horizontal axis to
  // preserve the apparent orbit direction across their different handedness.
  // One preview unit = one meter. The receiver adds its chosen world-space pivot.
  const cm = (value) => Math.round(value * 100000) / 1000 || 0;
  return { x: cm(z), y: cm(-x), z: cm(y) };
}

export function buildCameraPayload(snapshot, { streamId, sequence, final }) {
  return {
    type: "camera.orbit",
    version: 1,
    space: "unreal-pivot-cm",
    streamId,
    sequence,
    phase: final ? "end" : "move",
    position: unrealVector(snapshot.position),
    target: unrealVector(snapshot.target),
    // This is VERTICAL FOV in degrees; Unreal camera FOV is normally horizontal.
    fov: snapshot.fov,
    fovAxis: "vertical",
  };
}

/**
 * Bounded, latest-only camera stream. A final pose bypasses the 50ms rate limit,
 * but never bypasses backpressure. Deferred poses expire after 250ms and are
 * discarded on disconnect; nothing is replayed after reconnection.
 */
export function createCameraStream({
  streamId,
  isReady,
  canWrite,
  send,
  onPublish = () => {},
  onError = () => {},
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (timer) => clearTimeout(timer),
}) {
  let disposed = false;
  let latest = null;
  let timer = null;
  let writing = false;
  let sequence = 0;
  let lastSentAt = -Infinity;

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function schedule(delay = CAMERA_INTERVAL_MS) {
    if (timer !== null || disposed || !latest) return;
    timer = setTimer(() => {
      timer = null;
      flush();
    }, Math.max(1, delay));
  }

  function flush() {
    if (disposed || !latest) return;
    if (!isReady() || now() - latest.createdAt >= CAMERA_MAX_AGE_MS) {
      latest = null;
      cancelTimer();
      return;
    }
    if (writing || !canWrite()) {
      schedule();
      return;
    }
    const delay = CAMERA_INTERVAL_MS - (now() - lastSentAt);
    if (!latest.final && delay > 0) {
      schedule(delay);
      return;
    }

    const next = latest;
    latest = null;
    cancelTimer();
    const payload = buildCameraPayload(next.snapshot, { streamId, sequence: ++sequence, final: next.final });
    writing = true;
    lastSentAt = now();
    let finished = false;
    let failed = false;
    const complete = (error) => {
      if (disposed || finished) return;
      finished = true;
      writing = false;
      if (error) {
        failed = true;
        latest = null;
        cancelTimer();
        onError();
      } else if (latest) {
        // Keep one scheduled flush; do not build a recursive write chain.
        schedule(latest.final ? 1 : Math.max(1, CAMERA_INTERVAL_MS - (now() - lastSentAt)));
      }
    };
    try {
      send(payload, complete);
      // Handed to the local MQTT transport. QoS 0 has no broker acknowledgement.
      if (!disposed && !failed) onPublish(payload);
    } catch {
      complete(new Error("Camera write failed."));
    }
  }

  function publish(input, { final = false } = {}) {
    if (disposed || !isReady()) return false;
    let snapshot;
    try {
      snapshot = parseCameraSnapshot(input);
      if (typeof final !== "boolean") return false;
    } catch {
      return false;
    }
    latest = { snapshot, final, createdAt: now() };
    if (final) cancelTimer();
    flush();
    // Accepted for immediate/coalesced local writing, not guaranteed delivery.
    return true;
  }

  function cancelPending() {
    // A discrete view/reset command supersedes poses not handed to MQTT yet.
    // Keep the active write and sequence intact so a later drag can resume.
    latest = null;
    cancelTimer();
  }

  function stop() {
    disposed = true;
    cancelPending();
  }

  return { publish, cancelPending, stop };
}
