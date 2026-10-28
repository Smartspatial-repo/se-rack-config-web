"use client";

import { memo } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { ArrowRight, Check } from "lucide-react";
import { alpha } from "@mui/material/styles";

export const RackChoiceCard = memo(function RackChoiceCard({
  title,
  description,
  icon,
  onClick,
  selected = false,
  panelId,
}) {
  return (
    <ButtonBase
      type="button"
      onClick={onClick}
      aria-label={`Choose ${title}. ${description}`}
      aria-pressed={selected}
      aria-controls={panelId}
      sx={(theme) => ({
        width: "100%",
        minHeight: { xs: 156, sm: 192, md: 216 },
        display: "flex",
        justifyContent: "flex-start",
        textAlign: "left",
        gap: { xs: 2, md: 3 },
        p: { xs: 2.5, sm: 3, md: 4 },
        border: "1px solid",
        borderColor: selected ? "secondary.main" : "divider",
        borderRadius: 1.5,
        backgroundColor: selected
          ? alpha(theme.palette.secondary.main, 0.1)
          : alpha(theme.palette.background.paper, 0.72),
        transition: theme.transitions.create(
          ["background-color", "border-color", "color"],
          { duration: 120, easing: theme.transitions.easing.easeOut },
        ),
        "&:hover": {
          borderColor: selected ? "secondary.main" : "primary.dark",
          backgroundColor: alpha(
            selected ? theme.palette.secondary.main : theme.palette.primary.main,
            selected ? 0.14 : 0.055,
          ),
        },
        "&:active": {
          backgroundColor: alpha(theme.palette.secondary.main, 0.2),
          borderColor: "secondary.main",
          transitionDuration: "0ms",
        },
      })}
    >
      <Box
        aria-hidden="true"
        sx={{
          color: "primary.light",
          display: "flex",
          flexShrink: 0,
          "& svg": { width: { xs: 32, md: 48 }, height: { xs: 32, md: 48 } },
        }}
      >
        {icon}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="h3"
          component="span"
          sx={{ display: "block", mb: 1 }}
        >
          {title}
        </Typography>
        <Typography variant="body" component="span" color="text.secondary">
          {description}
        </Typography>
      </Box>

      <Box
        aria-hidden="true"
        sx={{
          width: { xs: 36, md: 44 },
          height: { xs: 36, md: 44 },
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          bgcolor: selected ? "action.selected" : "action.hover",
          color: selected ? "secondary.light" : "text.primary",
          border: 1,
          borderColor: selected ? "secondary.dark" : "divider",
        }}
      >
        {selected ? (
          <Check size={21} strokeWidth={1.75} />
        ) : (
          <ArrowRight size={21} strokeWidth={1.75} />
        )}
      </Box>
    </ButtonBase>
  );
});

export default RackChoiceCard;
