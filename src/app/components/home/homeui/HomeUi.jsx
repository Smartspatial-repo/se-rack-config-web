"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import LinearProgress from "@mui/material/LinearProgress";
import Snackbar from "@mui/material/Snackbar";
import Typography from "@mui/material/Typography";
import { Grid2X2, Server } from "lucide-react";
import RackHeader from "../nav/RackHeader";
import MGXPanel from "../MGX/MGXPanel";
import AdvancedSXPanel from "../AdvancedSX/AdvancedSXPanel";
import { planCduChange, planRackPlacement, planRackSwitch } from "../AdvancedSX/rackPlacement";
import RackChoiceCard from "./RackChoiceCard";
import SharedControls from "./SharedControls";
import RackViewControls from "./RackViewControls";
import RackOrbitPanel from "./RackOrbitPanel";
import VoiceAgentPanel from "./VoiceAgentPanel";
import RackOptionsTransition from "./RackOptionsTransition";
import { DEFAULT_RACK, DEFAULT_SHARED_CONTROLS, SLOT_IDS } from "./constants";

const MemoRackHeader = memo(RackHeader);
const MemoSharedControls = memo(SharedControls);
const MGX_ICON = <Server strokeWidth={1.75} />;
const ADVANCED_SX_ICON = <Grid2X2 strokeWidth={1.75} />;

const switchLabels = {
  waiting: "Finishing current request…",
  clearing: "Clearing current selections…",
  switching: "Switching rack…",
};

function RackSwitchStatus({ progress }) {
  if (!progress) return null;
  const clearing = progress.phase === "clearing";
  const count = clearing ? `${progress.completed} of ${progress.total}` : "";

  return (
    <Box
      sx={(theme) => ({
        position: "fixed", zIndex: theme.zIndex.snackbar,
        bottom: "max(20px, calc(env(safe-area-inset-bottom, 0px) + 12px))",
        insetInline: 0, mx: "auto", width: "min(340px, calc(100% - 32px))",
        boxSizing: "border-box", p: 2, pointerEvents: "none",
        border: 1, borderColor: "divider", borderRadius: 1.5,
        bgcolor: "background.paper", boxShadow: 8,
        animation: "rack-status-enter 140ms ease-out both",
        "@keyframes rack-status-enter": {
          from: { opacity: 0, transform: "translateY(5px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@media (prefers-reduced-motion: reduce)": {
          animation: "none",
          "& .MuiCircularProgress-root, & .MuiCircularProgress-circle": { animation: "none" },
          "& .MuiLinearProgress-bar": { transition: "none" },
        },
      })}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <CircularProgress aria-hidden="true" size={20} thickness={4} disableShrink sx={{ flexShrink: 0 }} />
        <Typography component="p" role="status" variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
          {switchLabels[progress.phase]}
        </Typography>
        {clearing && <Typography aria-hidden="true" variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{count}</Typography>}
      </Box>
      {clearing && (
        <LinearProgress
          variant="determinate"
          value={(progress.completed / progress.total) * 100}
          aria-label="Cleanup progress"
          aria-valuetext={`${count} cleanup commands confirmed`}
          sx={{ mt: 1.5, height: 3, borderRadius: 2, bgcolor: "divider" }}
        />
      )}
    </Box>
  );
}

// Audio-level updates belong to the voice UI, not the rack configuration tree.
const RackControlsArea = memo(function RackControlsArea({
  controls,
  onControlsChange,
  onRackSelect,
  onSystemSelect,
  onSlotSelect,
  onSlotChange,
  onCduChange,
  onCameraChange,
  onRearTilt,
  controlsDisabled,
}) {
  const [configuration, setConfiguration] = useState(() => ({
    rack: DEFAULT_RACK,
    model: null,
    slots: {},
    selectedSlot: null,
    controls: controls ?? DEFAULT_SHARED_CONTROLS,
  }));
  const { rack: selectedRack, model: selectedSystem, slots, selectedSlot } = configuration;
  const current = useRef(configuration);
  const activeEdit = useRef(null);
  const pendingSwitch = useRef(null);
  const pendingFocus = useRef(null);
  const [editing, setEditing] = useState(false);
  const [switchProgress, setSwitchProgress] = useState(null);
  const switching = switchProgress !== null;
  const [editNotice, setEditNotice] = useState("");

  const commit = useCallback((patch) => {
    current.current = { ...current.current, ...patch };
    setConfiguration(current.current);
  }, []);

  useLayoutEffect(() => {
    if (controls && controls !== current.current.controls) commit({ controls });
  }, [controls, commit]);

  useEffect(() => () => {
    activeEdit.current = null;
    pendingSwitch.current = null;
    pendingFocus.current = null;
  }, []);

  // Each patch describes exactly what this command changes. A later failure
  // leaves earlier confirmed changes in place for the next user-initiated switch.
  const sendStep = useCallback(async (step) => {
    const { command } = step;
    let delivery;
    let patch;
    switch (command.type) {
      case "advanced-sx.cdu.set":
        patch = { slots: step.slots };
        delivery = await onCduChange?.(command.enabled);
        break;
      case "advanced-sx.slot.set":
        patch = { slots: step.slots };
        delivery = await onSlotChange?.(command.slotId, command.equipmentId);
        break;
      case "advanced-sx.slot.focus":
        patch = { selectedSlot: command.slotId };
        delivery = await onSlotSelect?.(command.slotId);
        break;
      case "accessory.set": {
        const next = { ...current.current.controls, [command.accessory]: command.enabled };
        delivery = await onControlsChange?.(next, { key: command.accessory, value: command.enabled });
        patch = { controls: { ...current.current.controls, [command.accessory]: command.enabled } };
        break;
      }
      case "mgx.model.select":
        patch = { model: command.model };
        delivery = await onSystemSelect?.(command.model);
        break;
      case "rack.select":
        patch = { rack: command.rack };
        if (current.current.rack === "mgx" && command.rack !== "mgx") {
          patch.model = null;
        }
        delivery = await onRackSelect?.(command.rack);
        break;
      default:
        throw new Error("Unsupported rack action.");
    }
    // Local preview callbacks can return void. MQTT callbacks resolve on PUBACK.
    return delivery === false || delivery === null ? null : patch;
  }, [onCduChange, onSlotChange, onSlotSelect, onControlsChange, onSystemSelect, onRackSelect]);

  const applySteps = useCallback((steps, onConfirmed) => {
    if (controlsDisabled || activeEdit.current || !steps.length) return false;
    const edit = {};
    activeEdit.current = edit;
    setEditing(true);
    setEditNotice("");
    edit.done = (async () => {
      let completed = 0;
      try {
        for (const step of steps) {
          const patch = await sendStep(step);
          if (!patch || activeEdit.current !== edit) return false;
          commit(patch);
          completed += 1;
          onConfirmed?.(completed);
        }
        return true;
      } catch {
        return false;
      } finally {
        if (activeEdit.current === edit) {
          if (completed < steps.length) {
            setEditNotice(`Rack update stopped after ${completed} of ${steps.length} confirmed commands. Check the rack before trying again.`);
          }
          activeEdit.current = null;
          setEditing(false);
        }
      }
    })();
    return edit.done;
  }, [controlsDisabled, commit, sendStep]);

  const handleRackSelect = useCallback(async (destination) => {
    if (controlsDisabled || pendingSwitch.current) return;
    const request = {};
    pendingSwitch.current = request;
    setSwitchProgress({ phase: "waiting" });
    try {
      // A click immediately after an install/toggle uses its confirmed result.
      const edit = activeEdit.current;
      const focus = pendingFocus.current;
      if (edit && !(await edit.done)) return;
      if (focus && !(await focus.done)) return;
      if (pendingSwitch.current !== request) return;
      const steps = planRackSwitch(current.current, destination);
      // The last command selects the destination. It has its own status.
      const total = steps.length - 1;
      const updateProgress = (completed) => {
        if (completed <= total) {
          setSwitchProgress({ phase: completed < total ? "clearing" : "switching", completed, total });
        }
      };
      updateProgress(0);
      await applySteps(steps, updateProgress);
    } finally {
      if (pendingSwitch.current === request) {
        pendingSwitch.current = null;
        setSwitchProgress(null);
      }
    }
  }, [controlsDisabled, applySteps]);

  const selectMGX = useCallback(() => handleRackSelect("mgx"), [handleRackSelect]);
  const selectAdvancedSX = useCallback(() => handleRackSelect("advanced-sx"), [handleRackSelect]);

  const handleControlsChange = useCallback((_next, change) => {
    if (controlsDisabled || pendingSwitch.current) return;
    const { key, value } = change;
    if (key === "rackView" || key === "rackHidden") {
      const next = { ...current.current.controls, [key]: value };
      commit({ controls: next });
      onControlsChange?.(next, change);
    } else {
      return applySteps([{ command: { type: "accessory.set", accessory: key, enabled: value } }]);
    }
  }, [controlsDisabled, applySteps, commit, onControlsChange]);

  const handleResetView = useCallback(() => {
    handleControlsChange(null, { key: "rackView", value: "front" });
  }, [handleControlsChange]);

  const handleSystemSelect = useCallback((model) => {
    if (controlsDisabled || activeEdit.current || pendingSwitch.current || current.current.rack !== "mgx") return;
    if (current.current.model === model) {
      commit({ model: null });
      return;
    }
    return applySteps([{ command: { type: "mgx.model.select", model } }]);
  }, [controlsDisabled, applySteps, commit]);

  const handleSlotChange = useCallback((slotId, equipmentId) => {
    if (!pendingSwitch.current && current.current.rack === "advanced-sx") {
      return applySteps(planRackPlacement(current.current.slots, slotId, equipmentId));
    }
  }, [applySteps]);

  const handleCduChange = useCallback((enabled) => {
    if (!pendingSwitch.current && current.current.rack === "advanced-sx") {
      return applySteps(planCduChange(current.current.slots, enabled));
    }
  }, [applySteps]);

  const handleSlotSelect = useCallback((slotId) => {
    if (controlsDisabled || pendingSwitch.current || activeEdit.current || current.current.rack !== "advanced-sx") return;
    const focus = {};
    pendingFocus.current = focus;
    // Open the inspector on click. Retain its selection until a close is confirmed.
    if (slotId !== null) commit({ selectedSlot: slotId });
    focus.done = (async () => {
      try {
        const delivery = await onSlotSelect?.(slotId);
        if (delivery === false || delivery === null) return false;
        if (slotId === null && pendingFocus.current === focus) commit({ selectedSlot: null });
        return true;
      } catch {
        return false;
      } finally {
        if (pendingFocus.current === focus) pendingFocus.current = null;
      }
    })();
    return focus.done;
  }, [controlsDisabled, commit, onSlotSelect]);

  const mgxPanel = useMemo(() => (
    <MGXPanel value={selectedSystem} onChange={handleSystemSelect} />
  ), [selectedSystem, handleSystemSelect]);

  const advancedSXPanel = useMemo(() => (
    <AdvancedSXPanel
      slots={slots}
      selectedSlot={selectedSlot}
      onSlotSelect={handleSlotSelect}
      onSlotChange={handleSlotChange}
      busy={editing || switching}
    />
  ), [slots, selectedSlot, handleSlotChange, handleSlotSelect, editing, switching]);

  return (
    <>
      <Box inert={switching || undefined} sx={{ mb: { xs: 4, md: 5 } }}>
        <RackViewControls value={controls ?? configuration.controls} onChange={handleControlsChange} />
      </Box>

      <Box component="section" aria-labelledby="rack-heading">
        <Typography component="p" variant="overline" color="text.secondary" sx={{ mb: 1.5 }}>
          Rack configuration
        </Typography>
        <Typography id="rack-heading" variant="heading" sx={{ mb: 1.5 }}>Choose your rack</Typography>
        <Typography variant="body" color="text.secondary">Choose a rack, then configure its options below.</Typography>

        <Box inert={switching || undefined} aria-busy={switching} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 2, md: 2.5 }, mt: { xs: 3, md: 4 } }}>
          <RackChoiceCard title="MGX" description="Choose GB300 or Vera Rubin." icon={MGX_ICON} selected={selectedRack === "mgx"} panelId="rack-options" onClick={selectMGX} />
          <RackChoiceCard title="Advanced SX" description="Configure equipment across 48 rack slots." icon={ADVANCED_SX_ICON} selected={selectedRack === "advanced-sx"} panelId="rack-options" onClick={selectAdvancedSX} />
        </Box>
      </Box>

      <Box id="rack-options" role="region" aria-label="Rack configuration options" sx={{ pt: 4, minWidth: 0 }}>
        <Box aria-busy={editing || switching} inert={editing || switching || undefined}>
          <RackOptionsTransition activeRack={selectedRack} mgx={mgxPanel} advancedSX={advancedSXPanel} />
        </Box>
        <RackSwitchStatus progress={controlsDisabled ? null : switchProgress} />
        {editNotice && <Alert severity="warning" sx={{ mt: 2 }}>{editNotice}</Alert>}
      </Box>

      <Box inert={editing || switching || undefined} sx={{ mt: 4 }}>
        <MemoSharedControls
          value={controls ?? configuration.controls}
          onChange={handleControlsChange}
          selectedRack={selectedRack}
          cduEnabled={slots[SLOT_IDS[0]] === "cdu"}
          onCduChange={onSlotChange && !onCduChange ? undefined : handleCduChange}
          busy={editing || switching || controlsDisabled}
        />
      </Box>
      <Box inert={switching || undefined} sx={{ mt: 3 }}>
        <RackOrbitPanel
          onCameraChange={onCameraChange}
          onRearTilt={onRearTilt}
          onReset={handleResetView}
          disabled={controlsDisabled}
        />
      </Box>
    </>
  );
});

export function HomeUi({
  screenLabel = "Screen 01",
  connectionStatus = "preview",
  controls,
  onControlsChange,
  onRackSelect,
  onSystemSelect,
  onSlotSelect,
  onSlotChange,
  onCduChange,
  onCameraChange,
  onRearTilt,
  mqttFeedback,
  controlsDisabled = false,
  voiceStatus,
  voiceTranscript,
  voiceAudioLevel,
  onStartVoice,
  onEndVoice,
} = {}) {
  const [notice, setNotice] = useState("");
  const handleStartVoice = useCallback(() => {
    if (onStartVoice) onStartVoice();
    else setNotice("The voice agent is not connected yet.");
  }, [onStartVoice]);

  return (
    <Box sx={{ flex: 1, width: "100%", minWidth: 0, bgcolor: "background.default" }}>
      <Box component="a" href="#main-content" sx={{ position: "absolute", left: 16, top: -80, zIndex: 1500, p: 1.5, bgcolor: "primary.main", color: "primary.contrastText", borderRadius: 1, textDecoration: "none", "&:focus": { top: 16 } }}>Skip to content</Box>
      <MemoRackHeader screenLabel={screenLabel} connectionStatus={connectionStatus} />

      <Container variant="custom" maxWidth={false} component="main" id="main-content" tabIndex={-1} sx={{ pt: { xs: 4, md: 6 }, pb: 3, scrollMarginTop: { xs: 200, md: 140 } }}>
        <Box
          inert={controlsDisabled ? true : undefined}
          aria-busy={controlsDisabled}
          sx={{
            opacity: controlsDisabled ? 0.58 : 1,
            transition: "opacity 120ms ease",
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          }}
        >
          <RackControlsArea
            controls={controls}
            onControlsChange={onControlsChange}
            onRackSelect={onRackSelect}
            onSystemSelect={onSystemSelect}
            onSlotSelect={onSlotSelect}
            onSlotChange={onSlotChange}
            onCduChange={onCduChange}
            onCameraChange={onCameraChange}
            onRearTilt={onRearTilt}
            controlsDisabled={controlsDisabled}
          />
        </Box>
        <Box sx={{ mt: 4 }}>
          <VoiceAgentPanel status={voiceStatus ?? (onStartVoice ? "idle" : "unavailable")} transcript={voiceTranscript} audioLevel={voiceAudioLevel} onStart={handleStartVoice} onEnd={onEndVoice} />
        </Box>
        {connectionStatus === "preview" && <Typography component="p" variant="caption" color="text.secondary" sx={{ mt: 2, textAlign: "right" }}>UI preview · controls update locally</Typography>}
        {mqttFeedback && <Typography component="p" variant="caption" color="text.secondary" role="status" aria-live="polite" sx={{ mt: 2, minHeight: 20, textAlign: "right" }}>{mqttFeedback}</Typography>}
      </Container>

      <Snackbar open={Boolean(notice)} autoHideDuration={6000} onClose={(_, reason) => { if (reason !== "clickaway") setNotice(""); }} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="info" variant="filled" onClose={() => setNotice("")}>{notice}</Alert>
      </Snackbar>
    </Box>
  );
}

export default HomeUi;
