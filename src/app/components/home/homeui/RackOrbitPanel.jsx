"use client";

import { memo, useEffect, useId, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Fade from "@mui/material/Fade";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { ChevronLeft, ChevronRight, CircleHelp, Hand, Minus, MousePointer2, Move3D, Plus, RotateCcw } from "lucide-react";
import { alpha } from "@mui/material/styles";

// Dismiss once per page load. A full refresh starts a new module instance,
// while normal re-renders and client-side navigation keep this value.
let guideDismissedInMemory = false;

// Match the input device without changing the server-rendered markup.
const TOUCH_INPUT = "@media (hover: none), (pointer: coarse)";

function DragGesture() {
  return (
    <Box
      aria-hidden="true"
      sx={{ position: "relative", width: 120, maxWidth: "100%", height: 64, pointerEvents: "none" }}
    >
      <Box sx={{ position: "absolute", left: 19, right: 19, top: 13, borderTop: "1px dashed", borderColor: "primary.dark", opacity: 0.65 }} />
      <Box component={ChevronLeft} size={18} strokeWidth={1.6} sx={{ position: "absolute", left: 0, top: 4, color: "primary.main" }} />
      <Box component={ChevronRight} size={18} strokeWidth={1.6} sx={{ position: "absolute", right: 0, top: 4, color: "primary.main" }} />

      <Box
        sx={{
          position: "absolute", left: "calc(50% - 16px)", top: 24,
          width: 32, height: 36, color: "primary.light",
          animation: "orbit-guide-pointer-drag 3s cubic-bezier(0.4, 0, 0.2, 1) infinite",
          "@keyframes orbit-guide-pointer-drag": {
            "0%, 12%, 100%": { transform: "translateX(-18px) scale(1)" },
            "22%": { transform: "translateX(-18px) scale(0.94)" },
            "65%": { transform: "translateX(18px) scale(0.94)" },
            "78%": { transform: "translateX(18px) scale(1)" },
          },
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      >
        <Box
          sx={{
            position: "absolute", left: -3, top: -3, width: 18, height: 18,
            border: "1px solid", borderColor: "primary.main", borderRadius: "50%",
            bgcolor: "action.hover", opacity: 0,
            animation: "orbit-guide-pointer-press 3s ease-out infinite",
            "@keyframes orbit-guide-pointer-press": {
              "0%, 12%, 40%, 100%": { opacity: 0, transform: "scale(0.65)" },
              "20%": { opacity: 0.55, transform: "scale(0.8)" },
              "38%": { opacity: 0, transform: "scale(1.6)" },
            },
            [TOUCH_INPUT]: { left: 5, top: -4 },
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        />
        <Box component={MousePointer2} size={30} strokeWidth={1.6} sx={(theme) => ({ position: "relative", display: "block", fill: theme.palette.background.default, [TOUCH_INPUT]: { display: "none" } })} />
        <Box component={Hand} size={30} strokeWidth={1.6} sx={(theme) => ({ position: "relative", display: "none", fill: theme.palette.background.default, [TOUCH_INPUT]: { display: "block" } })} />
      </Box>
    </Box>
  );
}

export const RackOrbitPanel = memo(function RackOrbitPanel({ onCameraChange, onReset, disabled = false }) {
  const id = useId();
  const viewport = useRef(null);
  const scene = useRef(null);
  const callback = useRef(onCameraChange);
  const isDisabled = useRef(disabled);
  const frame = useRef(null);
  const gotItButton = useRef(null);
  const focusGuide = useRef(false);
  const restorePreviewFocus = useRef(false);
  const [guideState, setGuideState] = useState("pending");
  const [entered, setEntered] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const guideBlocksControls = guideState !== "done";
  const controlsDisabled = disabled || guideBlocksControls;
  callback.current = onCameraChange;
  isDisabled.current = controlsDisabled;

  useEffect(() => {
    setGuideState(guideDismissedInMemory ? "done" : "unseen");
  }, []);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setEntered(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.35)) {
        setEntered(true);
        observer.disconnect();
      }
    }, { threshold: 0.35 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (guideState === "unseen" && entered && ready && !disabled && !error) {
      setGuideState("open");
    }
  }, [guideState, entered, ready, disabled, error]);

  const openGuide = () => {
    // Stop an active drag before React updates the overlay.
    isDisabled.current = true;
    scene.current?.setDisabled(true);
    focusGuide.current = true;
    setGuideState("open");
  };

  const dismissGuide = () => {
    guideDismissedInMemory = true;
    restorePreviewFocus.current = true;
    setGuideState("closing");
  };

  useEffect(() => {
    let cancelled = false;
    let instance;
    import("./rackOrbitScene").then(({ createRackOrbitScene }) => {
      if (cancelled || !viewport.current) return;
      instance = createRackOrbitScene(viewport.current, {
        onCameraChange: (value, options) => {
          if (!cancelled && !isDisabled.current) callback.current?.(value, options);
        },
        onFatalError: (message) => {
          if (!cancelled) { setReady(false); setError(message); }
        },
      });
      instance.setDisabled(isDisabled.current);
      scene.current = instance;
      setReady(true);
    }).catch(() => {
      if (!cancelled) setError("The 3D preview could not load. Enable WebGL or try another browser.");
    });
    return () => {
      cancelled = true;
      instance?.dispose();
      if (scene.current === instance) scene.current = null;
    };
  }, []);

  useEffect(() => { scene.current?.setDisabled(controlsDisabled); }, [controlsDisabled]);
  useEffect(() => {
    if (guideState === "open" && focusGuide.current) {
      focusGuide.current = false;
      gotItButton.current?.focus({ preventScroll: true });
    }
    if (guideState === "done" && restorePreviewFocus.current) {
      restorePreviewFocus.current = false;
      if (!disabled && ready && !error) viewport.current?.focus({ preventScroll: true });
    }
  }, [guideState, disabled, ready, error]);
  const inactive = controlsDisabled || !ready || Boolean(error);

  const handleReset = () => {
    if (inactive || isDisabled.current) return;
    // reset() is silent: no camera.orbit samples can override Front view.
    if (scene.current?.reset() !== true) return;
    onReset?.();
  };

  return (
    <Box
      component="section"
      aria-labelledby={`${id}-title`}
      onKeyDown={(event) => {
        if (guideState === "open" && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          dismissGuide();
        }
      }}
      sx={{ minWidth: 0 }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mb: 1 }}>
        <Move3D size={19} strokeWidth={1.75} aria-hidden="true" />
        <Typography id={`${id}-title`} component="h2" variant="subheading">Rotate &amp; zoom</Typography>
        <Tooltip title="Show controls guide">
          <span>
            <IconButton
              aria-label="Show rotate and zoom guide"
              disabled={disabled || !ready || Boolean(error) || guideState !== "done"}
              onClick={openGuide}
              size="small"
              sx={{ width: 36, height: 36, color: "text.secondary" }}
            >
              <CircleHelp size={18} strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <Typography id={`${id}-help`} variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Drag to rotate the view. Use + and − to zoom.
      </Typography>

      <Box
        ref={frame}
        sx={(theme) => ({
          position: "relative",
          minWidth: 0,
          height: { xs: 280, sm: 320 },
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1.5,
          overflow: "hidden",
          background: `radial-gradient(ellipse at 50% 45%, ${alpha(theme.palette.primary.main, 0.055)}, transparent 68%), ${alpha(theme.palette.background.paper, 0.62)}`,
          "&:focus-within": { borderColor: "primary.dark" },
        })}
      >
        <Box
          ref={viewport}
          role="group"
          aria-label="Interactive rack camera preview"
          aria-describedby={`${id}-help ${id}-keyboard`}
          aria-disabled={inactive}
          aria-hidden={guideBlocksControls ? true : undefined}
          inert={guideBlocksControls ? true : undefined}
          tabIndex={inactive ? -1 : 0}
          sx={{
            width: "100%", height: "100%", cursor: inactive ? "default" : "grab",
            "&:active": { cursor: inactive ? "default" : "grabbing" },
            "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -3 },
          }}
        />

        {!ready && (
          <Stack role="status" spacing={1.5} sx={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", px: 3, textAlign: "center", pointerEvents: "none" }}>
            {!error && <CircularProgress size={22} thickness={3} />}
            <Typography variant="caption" color="text.secondary">{error || "Loading 3D preview…"}</Typography>
          </Stack>
        )}

        <Typography
          aria-hidden="true"
          variant="caption"
          color="text.secondary"
          sx={{ position: "absolute", left: 16, bottom: 17, pointerEvents: "none", fontSize: "0.6875rem", display: { xs: "none", sm: "block" } }}
        >
          {disabled ? "Connect to control" : "Drag to orbit"}
        </Typography>

        <Stack
          aria-hidden={guideBlocksControls ? true : undefined}
          inert={guideBlocksControls ? true : undefined}
          direction="row"
          spacing={0.5}
          sx={(theme) => ({
            position: "absolute", right: 12, bottom: 12, p: 0.5,
            border: "1px solid", borderColor: "divider", borderRadius: 1,
            bgcolor: alpha(theme.palette.background.default, 0.82),
            backdropFilter: "blur(10px)",
          })}
        >
          <Tooltip title="Reset view">
            <span>
              <IconButton aria-label="Reset view" disabled={inactive} onClick={handleReset} sx={{ width: 44, height: 44, borderRadius: 0.75 }}>
                <RotateCcw size={18} strokeWidth={1.75} aria-hidden="true" />
              </IconButton>
            </span>
          </Tooltip>
          <Box aria-hidden="true" sx={{ height: 22, alignSelf: "center", borderRight: 1, borderColor: "divider", mx: 0.25 }} />
          <Tooltip title="Zoom out">
            <span>
              <IconButton aria-label="Zoom out" disabled={inactive} onClick={() => scene.current?.zoom(-1)} sx={{ width: 44, height: 44, borderRadius: 0.75 }}>
                <Minus size={19} strokeWidth={1.75} aria-hidden="true" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Zoom in">
            <span>
              <IconButton aria-label="Zoom in" disabled={inactive} onClick={() => scene.current?.zoom(1)} sx={{ width: 44, height: 44, borderRadius: 0.75, color: "primary.light" }}>
                <Plus size={19} strokeWidth={1.75} aria-hidden="true" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Fade
          in={guideState === "open" && ready && !error}
          timeout={reducedMotion ? 0 : 200}
          mountOnEnter
          unmountOnExit
          onExited={() => setGuideState((state) => state === "closing" ? "done" : state)}
        >
          <Box
            role="region"
            aria-labelledby={`${id}-guide-title`}
            sx={(theme) => ({
              position: "absolute", inset: 0, zIndex: 3,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: { xs: 2, sm: 2.5 }, p: { xs: 2, sm: 3 },
              borderRadius: "inherit", textAlign: "center",
              bgcolor: alpha(theme.palette.background.default, 0.94),
              backdropFilter: "blur(8px)",
              touchAction: "pan-y",
            })}
          >
            <Typography id={`${id}-guide-title`} component="h3" variant="subheading">
              Explore your rack
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: { xs: 2, sm: 5 }, width: "100%", maxWidth: 400 }}>
              <Stack spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                <DragGesture />
                <Box sx={{ minHeight: 40 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, [TOUCH_INPUT]: { display: "none" } }}>Click &amp; drag</Typography>
                  <Typography variant="body2" sx={{ display: "none", fontWeight: 600, [TOUCH_INPUT]: { display: "block" } }}>Drag with one finger</Typography>
                  <Typography variant="caption" color="text.secondary">to rotate the view</Typography>
                </Box>
              </Stack>
              <Stack spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} aria-hidden="true" sx={{ alignItems: "center", height: 64 }}>
                  {[Minus, Plus].map((Icon, index) => (
                    <Box key={index} sx={{ display: "grid", placeItems: "center", width: 36, height: 36, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "action.hover", color: "primary.light" }}>
                      <Icon size={19} strokeWidth={1.75} />
                    </Box>
                  ))}
                </Stack>
                <Box sx={{ minHeight: 40 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>− / +</Typography>
                  <Typography variant="caption" color="text.secondary">to zoom out / in</Typography>
                </Box>
              </Stack>
            </Box>
            <Button
              ref={gotItButton}
              variant="contained"
              onClick={dismissGuide}
              disabled={guideState !== "open"}
              sx={{ minHeight: 44, minWidth: 132, boxShadow: "none", "&:hover": { boxShadow: "none" } }}
            >
              Got it
            </Button>
          </Box>
        </Fade>
      </Box>
      <Typography
        id={`${id}-keyboard`}
        component="p"
        variant="caption"
        color="text.secondary"
        sx={{ mt: 1.25 }}
      >
        Keyboard: focus the preview, then use arrow keys to rotate and + / − to zoom.
      </Typography>
    </Box>
  );
});

export default RackOrbitPanel;
