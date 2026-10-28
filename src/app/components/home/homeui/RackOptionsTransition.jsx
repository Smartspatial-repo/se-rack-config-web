"use client";

import { memo, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

const RACKS = ["mgx", "advanced-sx"];
const DURATION = 140;

/** Let the active panel size the document; crossfade without an inner scroller. */
export const RackOptionsTransition = memo(function RackOptionsTransition({ activeRack, mgx, advancedSX }) {
  const validRack = RACKS.includes(activeRack) ? activeRack : null;
  const [lastSelectedRack, setLastSelectedRack] = useState(validRack);
  const displayedRack = validRack ?? lastSelectedRack;

  useEffect(() => {
    if (validRack) setLastSelectedRack(validRack);
  }, [validRack]);

  return (
    <Box
      data-rack-options={displayedRack ? "open" : "empty"}
      data-active-rack={displayedRack ?? undefined}
      sx={{
        position: "relative",
        width: "100%",
        minWidth: 0,
        height: "auto",
        // Clip only the outgoing overlay. `clip` does not create a scroll container.
        overflow: "clip",
        overflowClipMargin: "8px",
      }}
    >
      {!displayedRack && (
        <Box sx={{ minHeight: 128, display: "grid", placeContent: "center", textAlign: "center", px: 3, py: 2 }}>
          <Typography component="p" variant="subheading">
            Select a rack to configure
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Your rack options will appear here.
          </Typography>
        </Box>
      )}

      {RACKS.map((rack) => {
        const active = rack === displayedRack;

        return (
          <Box
            key={rack}
            data-rack-panel={rack}
            inert={!active ? true : undefined}
            aria-hidden={!active ? true : undefined}
            sx={{
              // Only the active content participates in normal page layout.
              position: active ? "relative" : "absolute",
              inset: active ? "auto" : "0 0 auto",
              width: "100%",
              minWidth: 0,
              boxSizing: "border-box",
              p: 1,
              overflow: "visible",
              opacity: active ? 1 : 0,
              visibility: active ? "visible" : "hidden",
              pointerEvents: active ? "auto" : "none",
              zIndex: active ? 1 : 0,
              transition: `opacity ${DURATION}ms ease, visibility 0s linear`,
              transitionDelay: active ? "0ms, 0ms" : `0ms, ${DURATION}ms`,
              "@media (prefers-reduced-motion: reduce)": {
                transition: "none",
              },
            }}
          >
            {rack === "mgx" ? mgx : advancedSX}
          </Box>
        );
      })}
    </Box>
  );
});

export default RackOptionsTransition;
