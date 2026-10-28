"use client";

import { memo, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import { alpha, useTheme } from "@mui/material/styles";
import { orbFragmentShader, orbVertexShader } from "./voiceOrbShaders";

/** audioLevel is optional normalized output volume (0..1), supplied by your voice SDK. */
export const VoiceOrb = memo(function VoiceOrb({ status = "unavailable", audioLevel }) {
  const theme = useTheme();
  const hostRef = useRef(null);
  const repaintRef = useRef(null);
  const [ready, setReady] = useState(false);
  const cyan = theme.palette.primary.main;
  const emerald = theme.palette.secondary.main;
  const lime = theme.palette.success.main;
  const inputsRef = useRef({ status, audioLevel, cyan, emerald, lime });

  useEffect(() => {
    inputsRef.current = { status, audioLevel, cyan, emerald, lime };
    repaintRef.current?.();
  }, [status, audioLevel, cyan, emerald, lime]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let disposed = false;
    let renderer;
    let material;
    let geometry;
    let canvas;
    let resizeObserver;
    let intersectionObserver;
    let raf = 0;
    let visible = true;
    let contextLost = false;
    let failed = false;
    let hasFrame = false;
    let previousFrame = null;
    let elapsed = 0;
    let smoothedSpeed = 0.24;
    let previousColors = null;
    let previousSize = "";
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motion.matches;
    let draw = () => {};

    const stop = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      previousFrame = null;
    };

    const canRender = () => !disposed && !contextLost && !failed && visible && !document.hidden;
    const requestFrame = () => {
      if (canRender() && !raf) raf = window.requestAnimationFrame(draw);
    };

    const handleVisibility = () => {
      if (document.hidden) stop();
      else requestFrame();
    };
    const handleMotion = () => {
      reducedMotion = motion.matches;
      stop();
      requestFrame();
    };
    const handleContextLost = (event) => {
      event.preventDefault();
      contextLost = true;
      hasFrame = false;
      stop();
      if (!disposed) setReady(false);
    };
    const handleContextRestored = () => {
      contextLost = false;
      if (!disposed) requestFrame();
    };

    // Loading Three in the effect keeps WebGL entirely out of server rendering.
    import("three").then((THREE) => {
      if (disposed) return;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "default" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        canvas = renderer.domElement;
        canvas.setAttribute("aria-hidden", "true");
        canvas.style.cssText = "display:block;width:100%;height:100%;position:absolute;inset:0;";
        host.appendChild(canvas);
        canvas.addEventListener("webglcontextlost", handleContextLost);
        canvas.addEventListener("webglcontextrestored", handleContextRestored);

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        geometry = new THREE.PlaneGeometry(2, 2);
        const colors = inputsRef.current;
        material = new THREE.ShaderMaterial({
          vertexShader: orbVertexShader,
          fragmentShader: orbFragmentShader,
          uniforms: {
            uTime: { value: 0 },
            uEnergy: { value: 0.18 },
            uAspect: { value: 1 },
            uCyan: { value: new THREE.Color(colors.cyan) },
            uEmerald: { value: new THREE.Color(colors.emerald) },
            uLime: { value: new THREE.Color(colors.lime) },
          },
          transparent: true,
          depthWrite: false,
          depthTest: false,
        });
        scene.add(new THREE.Mesh(geometry, material));
        renderer.debug.onShaderError = () => {
          failed = true;
          stop();
          if (!disposed) setReady(false);
        };

        draw = (now) => {
          raf = 0;
          if (!canRender()) return;
          // Render each display frame; use elapsed time so speed is refresh-rate independent.
          const delta = previousFrame === null ? 1 / 60 : Math.min(Math.max((now - previousFrame) / 1000, 0), 0.05);
          previousFrame = now;
          const input = inputsRef.current;
          const level = !reducedMotion && Number.isFinite(input.audioLevel) ? Math.max(0, Math.min(1, input.audioLevel)) : null;
          const speaking = input.status === "speaking";
          const listening = input.status === "listening";
          const target = speaking ? 0.52 + (level ?? 0.45) * 0.4 : listening ? 0.32 + (level ?? 0) * 0.22 : input.status === "idle" ? 0.2 : 0.12;
          const speed = speaking ? 0.9 : listening ? 0.52 : 0.24;
          const blend = reducedMotion ? 1 : 1 - Math.exp(-delta * 6);
          smoothedSpeed += (speed - smoothedSpeed) * blend;
          if (!reducedMotion) elapsed += delta * smoothedSpeed;
          material.uniforms.uTime.value = elapsed;
          material.uniforms.uEnergy.value += (target - material.uniforms.uEnergy.value) * blend;
          // Palette conversion is only needed when the theme changes.
          if (!previousColors || previousColors.cyan !== input.cyan || previousColors.emerald !== input.emerald || previousColors.lime !== input.lime) {
            material.uniforms.uCyan.value.set(input.cyan);
            material.uniforms.uEmerald.value.set(input.emerald);
            material.uniforms.uLime.value.set(input.lime);
            previousColors = { cyan: input.cyan, emerald: input.emerald, lime: input.lime };
          }
          try {
            renderer.render(scene, camera);
            if (!failed && !disposed && !hasFrame) {
              hasFrame = true;
              setReady(true);
            }
          } catch {
            failed = true;
            if (!disposed) setReady(false);
          }
          if (!reducedMotion) requestFrame();
        };

        const resize = () => {
          if (disposed) return;
          const { width, height } = host.getBoundingClientRect();
          if (!width || !height) return;
          const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
          const size = `${width}:${height}:${ratio}`;
          if (size === previousSize) return;
          previousSize = size;
          renderer.setPixelRatio(ratio);
          renderer.setSize(width, height, false);
          material.uniforms.uAspect.value = width / height;
          requestFrame();
        };
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        if ("IntersectionObserver" in window) {
          intersectionObserver = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible) requestFrame();
            else stop();
          });
          intersectionObserver.observe(host);
        }
        document.addEventListener("visibilitychange", handleVisibility);
        motion.addEventListener("change", handleMotion);
        repaintRef.current = requestFrame;
        resize();
      } catch {
        failed = true;
        stop();
        if (!disposed) setReady(false);
        canvas?.remove();
        geometry?.dispose();
        material?.dispose();
        renderer?.dispose();
      }
    }).catch(() => {
      if (!disposed) setReady(false);
    });

    return () => {
      disposed = true;
      stop();
      repaintRef.current = null;
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      motion.removeEventListener("change", handleMotion);
      canvas?.removeEventListener("webglcontextlost", handleContextLost);
      canvas?.removeEventListener("webglcontextrestored", handleContextRestored);
      geometry?.dispose();
      material?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      canvas?.remove();
    };
  }, []);

  return (
    <Box
      aria-hidden="true"
      data-voice-orb
      data-renderer={ready ? "three" : "fallback"}
      data-state={status}
      sx={{ position: "relative", width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <Box sx={{
        position: "absolute", inset: "17%", borderRadius: "50%",
        opacity: ready ? 0 : 1,
        background: `radial-gradient(circle at 28% 24%, ${lime}, transparent 48%), conic-gradient(from 45deg, ${cyan}, ${emerald}, ${cyan})`,
        boxShadow: `inset -9px -12px 22px ${alpha(theme.palette.background.default, 0.85)}, 0 0 24px ${alpha(cyan, 0.14)}`,
        transition: "opacity 180ms ease",
        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
      }} />
      <Box ref={hostRef} sx={{ position: "absolute", inset: 0, opacity: ready ? 1 : 0 }} />
    </Box>
  );
});

export default VoiceOrb;
