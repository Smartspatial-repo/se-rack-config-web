"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Snackbar from "@mui/material/Snackbar";
import Typography from "@mui/material/Typography";
import { Grid2X2, Server } from "lucide-react";
import RackHeader from "../nav/RackHeader";
import MGXPanel from "../MGX/MGXPanel";
import AdvancedSXPanel from "../AdvancedSX/AdvancedSXPanel";
import { planCduChange, planRackPlacement } from "../AdvancedSX/rackPlacement";
import RackChoiceCard from "./RackChoiceCard";
import SharedControls from "./SharedControls";
import RackViewControls from "./RackViewControls";
import RackOrbitPanel from "./RackOrbitPanel";
import VoiceAgentPanel from "./VoiceAgentPanel";
import RackOptionsTransition from "./RackOptionsTransition";
import { DEFAULT_SHARED_CONTROLS } from "./constants";

const MemoRackHeader = memo(RackHeader);
const MemoSharedControls = memo(SharedControls);
const MGX_ICON = <Server strokeWidth={1.75} />;
const ADVANCED_SX_ICON = <Grid2X2 strokeWidth={1.75} />;

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
  controlsDisabled,
}) {
  const [localControls, setLocalControls] = useState(DEFAULT_SHARED_CONTROLS);
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [slots, setSlots] = useState({});
  const currentSlots = useRef(slots);
  const activeEdit = useRef(null);
  const [editing, setEditing] = useState(false);
  const [editNotice, setEditNotice] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedRack, setSelectedRack] = useState(null);

  useEffect(() => () => {
    activeEdit.current = null;
  }, []);

  const handleRackSelect = useCallback((rack) => {
    if (activeEdit.current) return;
    if (rack !== selectedRack) setSelectedRack(rack);
    onRackSelect?.(rack);
  }, [selectedRack, onRackSelect]);

  const selectMGX = useCallback(() => handleRackSelect("mgx"), [handleRackSelect]);
  const selectAdvancedSX = useCallback(() => handleRackSelect("advanced-sx"), [handleRackSelect]);

  const handleControlsChange = useCallback((next, change) => {
    if (controls === undefined) setLocalControls(next);
    onControlsChange?.(next, change);
  }, [controls, onControlsChange]);

  const handleResetView = useCallback(() => {
    if (controlsDisabled) return;
    handleControlsChange(
      { ...(controls ?? localControls), rackView: "front" },
      { key: "rackView", value: "front" },
    );
  }, [controls, localControls, controlsDisabled, handleControlsChange]);

  const handleSystemSelect = useCallback((system) => {
    setSelectedSystem(system);
    onSystemSelect?.(system);
  }, [onSystemSelect]);

  const applySteps = useCallback(async (steps) => {
    if (controlsDisabled || activeEdit.current || !steps.length) return;
    // Lock synchronously so a second click cannot start from a stale layout.
    activeEdit.current = steps;
    setEditing(true);
    setEditNotice("");
    let completed = 0;
    try {
      for (const step of steps) {
        const { command } = step;
        let result;
        try {
          result = command.type === "advanced-sx.cdu.set"
            ? await onCduChange?.(command.enabled)
            : await onSlotChange?.(command.slotId, command.equipmentId);
        } catch {
          // A custom publisher may reject instead of returning false.
          break;
        }
        if (activeEdit.current !== steps) return;
        // Legacy local preview callbacks return void. The MQTT callbacks
        // explicitly return true on PUBACK and false/null on failure.
        if (result === false || result === null) break;
        currentSlots.current = step.slots;
        setSlots(step.slots);
        completed += 1;
      }
    } finally {
      if (activeEdit.current === steps) {
        if (completed < steps.length) {
          setEditNotice(`Rack update stopped after ${completed} of ${steps.length} confirmed commands. Check the rack before trying again.`);
        }
        activeEdit.current = null;
        setEditing(false);
      }
    }
  }, [controlsDisabled, onCduChange, onSlotChange]);

  const handleSlotChange = useCallback((slotId, equipmentId) => (
    applySteps(planRackPlacement(currentSlots.current, slotId, equipmentId))
  ), [applySteps]);

  const handleCduChange = useCallback((enabled) => (
    applySteps(planCduChange(currentSlots.current, enabled))
  ), [applySteps]);

  const handleSlotSelect = useCallback((slotId) => {
    if (activeEdit.current) return;
    setSelectedSlot(slotId);
    onSlotSelect?.(slotId);
  }, [onSlotSelect]);

  const mgxPanel = useMemo(() => (
    <MGXPanel value={selectedSystem} onChange={handleSystemSelect} />
  ), [selectedSystem, handleSystemSelect]);

  const advancedSXPanel = useMemo(() => (
    <AdvancedSXPanel
      slots={slots}
      selectedSlot={selectedSlot}
      onSlotSelect={handleSlotSelect}
      onSlotChange={handleSlotChange}
      onCduChange={onSlotChange && !onCduChange ? undefined : handleCduChange}
      busy={editing}
    />
  ), [slots, selectedSlot, handleSlotChange, handleSlotSelect, handleCduChange, editing, onSlotChange, onCduChange]);

  return (
    <>
      <Box sx={{ mb: { xs: 4, md: 5 } }}>
        <RackViewControls value={controls ?? localControls} onChange={handleControlsChange} />
      </Box>

      <Box component="section" aria-labelledby="rack-heading">
        <Typography component="p" variant="overline" color="text.secondary" sx={{ mb: 1.5 }}>
          Rack configuration
        </Typography>
        <Typography id="rack-heading" variant="heading" sx={{ mb: 1.5 }}>Choose your rack</Typography>
        <Typography variant="body" color="text.secondary">Choose a rack, then configure its options below.</Typography>

        <Box inert={editing ? true : undefined} aria-busy={editing} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 2, md: 2.5 }, mt: { xs: 3, md: 4 } }}>
          <RackChoiceCard title="MGX" description="Choose GB300 or Vera Rubin." icon={MGX_ICON} selected={selectedRack === "mgx"} panelId="rack-options" onClick={selectMGX} />
          <RackChoiceCard title="Advanced SX" description="Configure equipment across 48 rack slots." icon={ADVANCED_SX_ICON} selected={selectedRack === "advanced-sx"} panelId="rack-options" onClick={selectAdvancedSX} />
        </Box>
      </Box>

      <Box id="rack-options" role="region" aria-label="Rack configuration options" sx={{ pt: 4, minWidth: 0 }}>
        <RackOptionsTransition activeRack={selectedRack} mgx={mgxPanel} advancedSX={advancedSXPanel} />
        {editNotice && selectedRack === "advanced-sx" && <Alert severity="warning" sx={{ mt: 2 }}>{editNotice}</Alert>}
      </Box>

      <Box sx={{ mt: 4 }}>
        <MemoSharedControls value={controls ?? localControls} onChange={handleControlsChange} selectedRack={selectedRack} />
      </Box>
      <Box sx={{ mt: 3 }}>
        <RackOrbitPanel onCameraChange={onCameraChange} onReset={handleResetView} disabled={controlsDisabled} />
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
