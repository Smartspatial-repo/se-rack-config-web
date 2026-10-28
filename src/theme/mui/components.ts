import { alpha, type Components, type Theme } from "@mui/material/styles";
import { fontFamily } from "./typography";
import { container } from "./container";

export const components: Components<Theme> = {
  MuiContainer: container,
  MuiCssBaseline: {
    styleOverrides: (theme) => ({
      html: {
        minHeight: "100%",
        boxSizing: "border-box",
        colorScheme: "dark",
      },
      "*, *::before, *::after": { boxSizing: "inherit" },
      body: {
        minHeight: "100vh",
        "@supports (min-height: 100dvh)": { minHeight: "100dvh" },
        margin: 0,
        display: "flex",
        flexDirection: "column",
        fontFamily,
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary,
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      },
      "button, input, textarea, select": { font: "inherit" },
      "::selection": {
        color: theme.palette.primary.contrastText,
        backgroundColor: theme.palette.primary.main,
      },
      "@media (prefers-reduced-motion: reduce)": {
        "*, *::before, *::after": {
          animationDuration: "0.01ms !important",
          animationIterationCount: "1 !important",
          transitionDuration: "0.01ms !important",
          scrollBehavior: "auto !important",
        },
      },
    }),
  },
  MuiTypography: {
    defaultProps: {
      variantMapping: {
        heading: "h1",
        subheading: "h2",
        body: "p",
        caption: "span",
      },
    },
  },
  MuiButtonBase: {
    defaultProps: { disableRipple: true },
    styleOverrides: {
      root: ({ theme }) => ({
        touchAction: "manipulation",
        transition: theme.transitions.create(
          ["background-color", "border-color", "color"],
          { duration: 120, easing: theme.transitions.easing.easeOut },
        ),
        "&:active": {
          backgroundColor: theme.palette.action.selected,
          transitionDuration: "0ms",
        },
        "&.Mui-focusVisible": {
          outline: `2px solid ${theme.palette.primary.light}`,
          outlineOffset: 4,
        },
      }),
    },
  },
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: ({ theme }) => ({
        minHeight: 44,
        padding: "10px 20px",
        textTransform: "none",
        fontWeight: 600,
        boxShadow: "none",
        transition: theme.transitions.create(
          ["background-color", "border-color", "color"],
          { duration: 120, easing: theme.transitions.easing.easeOut },
        ),
        "&:active": { transitionDuration: "0ms" },
      }),
      outlined: ({ theme }) => ({
        borderColor: theme.palette.divider,
        "&:hover": {
          borderColor: theme.palette.primary.main,
          backgroundColor: theme.palette.action.hover,
        },
      }),
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        minWidth: 44,
        minHeight: 44,
        transition: theme.transitions.create(["background-color", "color"], {
          duration: 120,
          easing: theme.transitions.easing.easeOut,
        }),
        "&:active": { transitionDuration: "0ms" },
      }),
    },
  },
  MuiPaper: {
    defaultProps: { elevation: 0 },
    styleOverrides: { root: { backgroundImage: "none" } },
  },
  MuiDivider: {
    styleOverrides: { root: ({ theme }) => ({ borderColor: theme.palette.divider }) },
  },
  MuiToggleButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        minHeight: 44,
        padding: "10px 18px",
        color: theme.palette.text.secondary,
        borderColor: theme.palette.divider,
        fontWeight: 500,
        textTransform: "none",
        transition: theme.transitions.create(
          ["background-color", "border-color", "color"],
          { duration: 120, easing: theme.transitions.easing.easeOut },
        ),
        "&:active": { transitionDuration: "0ms" },
        "&:hover": { backgroundColor: theme.palette.action.hover },
        "&.Mui-selected": {
          color: theme.palette.text.primary,
          backgroundColor: theme.palette.action.selected,
          borderColor: theme.palette.secondary.main,
        },
        "&.Mui-selected:hover": {
          backgroundColor: alpha(theme.palette.secondary.main, 0.24),
        },
      }),
    },
  },
  MuiSwitch: {
    // The outer control remains a 64 × 44px target; only the track is compact.
    defaultProps: { color: "secondary" },
    styleOverrides: {
      root: { width: 64, height: 44, padding: 10, flexShrink: 0 },
      switchBase: ({ theme }) => ({
        padding: 12,
        color: theme.palette.text.primary,
        transition: theme.transitions.create(["transform", "color"], {
          duration: 120,
          easing: theme.transitions.easing.easeOut,
        }),
        "&.Mui-checked": {
          transform: "translateX(20px)",
          color: theme.palette.secondary.contrastText,
          "& + .MuiSwitch-track": {
            backgroundColor: theme.palette.secondary.main,
            opacity: 1,
          },
        },
        "&.Mui-focusVisible": {
          outlineOffset: 0,
          borderRadius: "50%",
        },
      }),
      thumb: { width: 20, height: 20, boxShadow: "none" },
      track: ({ theme }) => ({
        borderRadius: 12,
        backgroundColor: alpha(theme.palette.text.secondary, 0.32),
        opacity: 1,
        transition: theme.transitions.create(["background-color", "opacity"], {
          duration: 120,
          easing: theme.transitions.easing.easeOut,
        }),
      }),
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) => ({
        minHeight: 44,
        backgroundColor: alpha(theme.palette.background.paper, 0.7),
        "& .MuiOutlinedInput-notchedOutline": { borderColor: theme.palette.divider },
        "&:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: theme.palette.text.disabled,
        },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
          borderColor: theme.palette.primary.main,
        },
      }),
    },
  },
};

export default components;
