import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const MIN_DISTANCE = 3;
const MAX_DISTANCE = 12;
const MAX_VERTICAL_PAN = 0.30; // Metres above or below the rack's centre.
const MIN_POLAR = 0.2;
const MAX_POLAR = Math.PI / 2 + 0.18;
const INITIAL_FOV = 40;
// Both entry and Reset face the +Z server panels at the existing viewing distance.
const FRONT_POSITION = new THREE.Vector3(0, 0, Math.hypot(3.2, 2.1, 4.4));

// This helper is loaded by the client component after mount. One preview unit
// represents one metre; the MQTT layer maps these vectors to Unreal centimetres.
export function createRackOrbitScene(element, { onCameraChange, onFatalError }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(INITIAL_FOV, 1, 0.1, 40);
  camera.position.copy(FRONT_POSITION);
  const framePosition = new THREE.Vector3();
  const frameTarget = new THREE.Vector3();
  const frameQuaternion = new THREE.Quaternion();

  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const geometries = new Set();
  const materials = new Set();
  const disposables = new Set();
  let renderer;
  let controls;
  let controlsConnected = false;
  let resizeObserver;
  let frame = null;
  let disposed = false;
  let disabled = false;
  let insideFrame = false;
  let suppressChanges = false;
  let gesture = false;
  let userSession = false;
  let userChanged = false;
  let dirty = false;
  let tween = null;
  let hasSize = false;
  const touches = new Map();
  let pinchDistance = 0;
  let verticalPanActive = false;
  let panPixels = 0;

  const geometry = (value) => { geometries.add(value); return value; };
  const material = (value) => { materials.add(value); return value; };
  const available = () => !disposed && !disabled && !document.hidden;

  function snapshot() {
    return {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
      fov: camera.fov,
    };
  }

  function invalidate() {
    if (disposed || frame !== null || insideFrame || document.hidden) return;
    frame = requestAnimationFrame(renderFrame);
  }

  function changed() {
    if (suppressChanges || disposed) return;
    if (userSession && available()) dirty = true;
    invalidate();
  }

  // Flush a tiny remaining damping delta so an idle resize or later interaction
  // cannot resume an old drag. The settled snapshot is sent only by renderFrame.
  function clearDamping(keepPosition = false) {
    if (!controls) return;
    const position = keepPosition ? camera.position.clone() : null;
    suppressChanges = true;
    controls.enableDamping = false;
    controls.update();
    if (position) {
      camera.position.copy(position);
      controls.update();
    }
    controls.enableDamping = !media.matches;
    suppressChanges = false;
  }

  function renderFrame(now) {
    frame = null;
    if (disposed) return;
    insideFrame = true;
    framePosition.copy(camera.position);
    frameTarget.copy(controls.target);
    frameQuaternion.copy(camera.quaternion);
    if (panPixels !== 0) applyVerticalPan();
    if (!verticalPanActive && touches.size === 2) applyPinch();
    if (tween && available()) {
      const progress = Math.min(1, (now - tween.startedAt) / tween.duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = new THREE.Spherical(
        THREE.MathUtils.lerp(tween.from.radius, tween.to.radius, eased),
        THREE.MathUtils.lerp(tween.from.phi, tween.to.phi, eased),
        THREE.MathUtils.lerp(tween.from.theta, tween.to.theta, eased),
      );
      camera.position.setFromSpherical(next).add(controls.target);
      if (progress === 1) tween = null;
    }

    controls.update();
    // At an exact distance limit, OrbitControls can report a change for a tiny
    // floating-point clamp on every update. Compare the actual pose so the
    // demand loop still stops at both zoom limits.
    const moving = framePosition.distanceToSquared(camera.position) > 1e-12
      || frameTarget.distanceToSquared(controls.target) > 1e-12
      || 8 * (1 - frameQuaternion.dot(camera.quaternion)) > 1e-12;
    if (moving && userSession && available()) dirty = true;
    if (dirty && userSession && available()) {
      dirty = false;
      userChanged = true;
      onCameraChange?.(snapshot(), { final: false });
    }

    if (!moving && !tween && !gesture && userSession) {
      clearDamping();
      if (userChanged && available()) onCameraChange?.(snapshot(), { final: true });
      userSession = false;
      userChanged = false;
      dirty = false;
    }

    if (hasSize) renderer.render(scene, camera);
    insideFrame = false;
    // No permanent animation loop: render only while damping/tweening or after
    // an input/resize. A held, stationary pointer does not keep the GPU running.
    if (moving || tween) invalidate();
  }

  function beginGesture() {
    if (!available()) return;
    tween = null;
    gesture = true;
    userSession = true;
    element.focus({ preventScroll: true });
  }

  function endGesture() {
    gesture = false;
    invalidate();
  }

  function fingerDistance() {
    const [a, b] = touches.values();
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function applyPinch() {
    const distance = fingerDistance();
    if (distance >= 1 && pinchDistance >= 1 && distance !== pinchDistance) {
      controls.dollyOut(distance / pinchDistance);
    }
    pinchDistance = distance;
  }

  function applyVerticalPan() {
    const height = Math.max(1, renderer.domElement.clientHeight);
    // A quarter of the preview height moves from centre to one limit.
    const nextY = THREE.MathUtils.clamp(
      controls.target.y + (panPixels / height) * 4 * MAX_VERTICAL_PAN,
      -MAX_VERTICAL_PAN, MAX_VERTICAL_PAN,
    );
    panPixels = 0;
    // Translate the camera and the orbit centre together so the rack follows
    // the fingers without a change in viewing angle or zoom distance.
    camera.position.y += nextY - controls.target.y;
    controls.target.y = nextY;
  }

  function touchDown(event) {
    if (event.pointerType !== "touch" || !available()) return;
    // Only the preview owns touch. OrbitControls still owns mouse/pen drags.
    event.stopImmediatePropagation();
    if (touches.has(event.pointerId)) return;
    if (!verticalPanActive && touches.size === 2) applyPinch();
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    renderer.domElement.setPointerCapture(event.pointerId);
    if (verticalPanActive) return;
    if (touches.size === 1) {
      beginGesture();
    } else if (touches.size === 2) {
      clearDamping(true);
      pinchDistance = fingerDistance();
    } else {
      verticalPanActive = true;
      clearDamping(true);
    }
  }

  function touchMove(event) {
    const point = touches.get(event.pointerId);
    if (!point) return;
    event.stopImmediatePropagation();
    const dx = event.clientX - point.x;
    const dy = event.clientY - point.y;
    point.x = event.clientX;
    point.y = event.clientY;
    if (verticalPanActive) {
      if (touches.size === 3 && dy !== 0) {
        // Collect the average vertical displacement across the three fingers.
        panPixels += dy / 3;
        invalidate();
      }
    } else if (touches.size === 1) {
      const radians = 2 * Math.PI * controls.rotateSpeed / Math.max(1, renderer.domElement.clientHeight);
      if (dx) controls.rotateLeft(dx * radians);
      if (dy) controls.rotateUp(dy * radians);
    } else {
      // Sample both fingers together once per frame, including when they
      // travel in parallel and their separation does not actually change.
      invalidate();
    }
  }

  function touchEnd(event) {
    if (event.pointerType !== "touch") return;
    event.stopImmediatePropagation();
    if (!touches.has(event.pointerId)) return;
    if (!verticalPanActive && touches.size === 2) applyPinch();
    touches.delete(event.pointerId);
    if (touches.size === 0) {
      verticalPanActive = false;
      endGesture();
    }
  }

  function clearTouches() {
    for (const id of touches.keys()) {
      if (renderer.domElement.hasPointerCapture(id)) renderer.domElement.releasePointerCapture(id);
    }
    touches.clear();
    verticalPanActive = false;
    panPixels = 0;
  }

  function moveCamera(update) {
    if (!available() || !controls) return false;
    const previousTarget = tween?.to.clone();
    clearDamping();
    const from = new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(controls.target),
    );
    const to = previousTarget || from.clone();
    // Spherical coordinates wrap at ±π. Keep a repeated keyboard nudge on the
    // short arc when a still-running tween crosses that seam.
    const angle = to.theta - from.theta;
    to.theta = from.theta + Math.atan2(Math.sin(angle), Math.cos(angle));
    update(to);
    to.radius = THREE.MathUtils.clamp(to.radius, MIN_DISTANCE, MAX_DISTANCE);
    to.phi = THREE.MathUtils.clamp(to.phi, MIN_POLAR, MAX_POLAR);
    if (Math.abs(to.radius - from.radius) < 0.00001
      && Math.abs(to.theta - from.theta) < 0.00001
      && Math.abs(to.phi - from.phi) < 0.00001) return false;

    userSession = true;
    if (media.matches) {
      tween = null;
      camera.position.setFromSpherical(to).add(controls.target);
      controls.update();
    } else {
      tween = { from, to, startedAt: performance.now(), duration: 160 };
    }
    invalidate();
    return true;
  }

  function zoom(direction) {
    return moveCamera((spherical) => { spherical.radius *= direction > 0 ? 0.85 : 1 / 0.85; });
  }

  function keyDown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || !available()) return;
    const actions = {
      ArrowLeft: () => moveCamera((spherical) => { spherical.theta -= 0.16; }),
      ArrowRight: () => moveCamera((spherical) => { spherical.theta += 0.16; }),
      ArrowUp: () => moveCamera((spherical) => { spherical.phi -= 0.12; }),
      ArrowDown: () => moveCamera((spherical) => { spherical.phi += 0.12; }),
      "+": () => zoom(1),
      "=": () => zoom(1),
      "-": () => zoom(-1),
    };
    if (!actions[event.key]) return;
    event.preventDefault();
    actions[event.key]();
  }

  function cancelInteraction(keepPosition = false) {
    tween = null;
    gesture = false;
    userSession = false;
    userChanged = false;
    dirty = false;
    clearDamping(keepPosition);
  }

  // Reset is a local preview operation. The caller sends the existing Front
  // view command; no camera.orbit sample (including a final sample) is emitted.
  function reset() {
    if (!available() || !controls) return false;
    clearTouches();
    cancelInteraction();
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    controls.disconnect();
    controlsConnected = false;

    suppressChanges = true;
    camera.position.copy(FRONT_POSITION);
    controls.target.set(0, 0, 0);
    camera.fov = INITIAL_FOV;
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.update();
    suppressChanges = false;

    syncControls();
    invalidate();
    return true;
  }

  function setDisabled(value) {
    if (disposed) return;
    disabled = Boolean(value);
    if (disabled) {
      clearTouches();
      cancelInteraction();
    }
    syncControls();
    invalidate();
  }

  function syncControls() {
    const enabled = available();
    controls.enabled = enabled;
    // Reset pointer tracking when a connection/visibility change interrupts a
    // drag. An old pointer must not resume when the connection becomes ready.
    if (enabled && !controlsConnected) {
      controls.connect(renderer.domElement);
      controlsConnected = true;
    } else if (!enabled && controlsConnected) {
      controls.disconnect();
      controlsConnected = false;
    }
    renderer.domElement.style.cursor = "inherit";
    renderer.domElement.style.touchAction = enabled ? "none" : "auto";
  }

  function resize() {
    if (disposed) return;
    const width = element.clientWidth;
    const height = element.clientHeight;
    hasSize = width > 0 && height > 0;
    if (!hasSize) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidate();
  }

  function visibilityChanged() {
    if (disposed) return;
    if (document.hidden) {
      clearTouches();
      cancelInteraction();
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    }
    syncControls();
    if (!document.hidden) resize();
  }

  function motionChanged() {
    if (disposed) return;
    // Existing input settles on the next frame; changing preferences is not
    // itself a new interaction or a reason to publish a camera command.
    controls.enableDamping = !media.matches;
    if (media.matches && tween) {
      camera.position.setFromSpherical(tween.to).add(controls.target);
      tween = null;
      controls.update();
    }
    invalidate();
  }

  function contextLost(event) {
    event.preventDefault();
    if (disposed) return;
    dispose();
    onFatalError?.("The 3D preview was interrupted. Reload this page to restore it.");
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    resizeObserver?.disconnect();
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", visibilityChanged);
    media.removeEventListener("change", motionChanged);
    element.removeEventListener("keydown", keyDown);
    if (controls) {
      controls.removeEventListener("start", beginGesture);
      controls.removeEventListener("end", endGesture);
      controls.removeEventListener("change", changed);
      controls.dispose();
    }
    for (const resource of disposables) resource.dispose();
    for (const resource of geometries) resource.dispose();
    for (const resource of materials) resource.dispose();
    if (renderer) {
      clearTouches();
      const canvas = renderer.domElement;
      canvas.removeEventListener("pointerdown", touchDown, true);
      canvas.removeEventListener("pointermove", touchMove, true);
      canvas.removeEventListener("pointerup", touchEnd, true);
      canvas.removeEventListener("pointercancel", touchEnd, true);
      canvas.removeEventListener("lostpointercapture", touchEnd, true);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }
  }

  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%;";
    renderer.domElement.setAttribute("aria-hidden", "true");
    element.appendChild(renderer.domElement);

    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", touchDown, true);
    canvas.addEventListener("pointermove", touchMove, true);
    canvas.addEventListener("pointerup", touchEnd, true);
    canvas.addEventListener("pointercancel", touchEnd, true);
    canvas.addEventListener("lostpointercapture", touchEnd, true);
    controls = new OrbitControls(camera, renderer.domElement);
    controlsConnected = true;
    controls.target.set(0, 0, 0);
    controls.enablePan = false;
    controls.enableZoom = false; // Mouse wheel scrolls the page; pinch uses dollyOut directly.
    controls.enableDamping = !media.matches;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 0.6;
    controls.minDistance = MIN_DISTANCE;
    controls.maxDistance = MAX_DISTANCE;
    controls.minPolarAngle = MIN_POLAR;
    controls.maxPolarAngle = MAX_POLAR;
    controls.mouseButtons.MIDDLE = null;
    controls.mouseButtons.RIGHT = null;
    controls.touches.TWO = null;
    controls.update();

    const chassis = material(new THREE.MeshStandardMaterial({ color: "#123039", metalness: 0.4, roughness: 0.55 }));
    const dark = material(new THREE.MeshStandardMaterial({ color: "#091b21", metalness: 0.25, roughness: 0.6 }));
    const cyan = material(new THREE.LineBasicMaterial({ color: "#32F5FF", transparent: true, opacity: 0.38 }));
    const led = material(new THREE.MeshBasicMaterial({ color: "#5AE8C4" }));
    const bodyGeometry = geometry(new THREE.BoxGeometry(1.08, 2, 0.82));
    const body = new THREE.Mesh(bodyGeometry, chassis);
    scene.add(body);
    const edges = new THREE.LineSegments(geometry(new THREE.EdgesGeometry(bodyGeometry)), cyan);
    scene.add(edges);

    const panelGeometry = geometry(new THREE.BoxGeometry(0.86, 0.17, 0.04));
    const ledGeometry = geometry(new THREE.BoxGeometry(0.025, 0.025, 0.012));
    const panels = new THREE.InstancedMesh(panelGeometry, dark, 8);
    const leds = new THREE.InstancedMesh(ledGeometry, led, 8);
    disposables.add(panels);
    disposables.add(leds);
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < 8; index += 1) {
      const y = 0.77 - index * 0.22;
      panels.setMatrixAt(index, matrix.makeTranslation(0, y, 0.425));
      leds.setMatrixAt(index, matrix.makeTranslation(0.34, y, 0.452));
    }
    scene.add(panels, leds);

    const plinth = new THREE.Mesh(geometry(new THREE.BoxGeometry(1.3, 0.07, 1.04)), dark);
    plinth.position.y = -1.065;
    scene.add(plinth);
    const grid = new THREE.GridHelper(8, 16, "#1C4148", "#1C4148");
    grid.position.y = -1.11;
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    geometries.add(grid.geometry);
    materials.add(grid.material);
    scene.add(grid);
    scene.add(new THREE.HemisphereLight("#c0f7ff", "#061617", 2.7));
    const key = new THREE.DirectionalLight("#83FAFF", 2.4);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#00D6A0", 1.5);
    rim.position.set(-3, 2, -3);
    scene.add(rim);

    controls.addEventListener("start", beginGesture);
    controls.addEventListener("end", endGesture);
    controls.addEventListener("change", changed);
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    element.addEventListener("keydown", keyDown);
    document.addEventListener("visibilitychange", visibilityChanged);
    media.addEventListener("change", motionChanged);
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(element);
    } else {
      window.addEventListener("resize", resize);
    }
    resize();
    return { zoom, reset, setDisabled, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
