import type { PaletteOptions } from "@mui/material/styles";

export const palette = {
  mode: "dark",
  primary: {
    main: "#32F5FF",
    light: "#83FAFF",
    dark: "#009EA8",
    contrastText: "#061617",
  },
  secondary: {
    main: "#00D6A0",
    light: "#5AE8C4",
    dark: "#008F6B",
    contrastText: "#061617",
  },
  success: {
    main: "#A5F730",
    light: "#C3FA79",
    dark: "#6EA91B",
    contrastText: "#061617",
  },
  info: {
    main: "#32F5FF",
    contrastText: "#061617",
  },
  warning: {
    main: "#FFCA66",
    contrastText: "#061617",
  },
  error: {
    main: "#FF6B7A",
    contrastText: "#061617",
  },
  background: {
    default: "#061617",
    paper: "#0C2024",
  },
  text: {
    primary: "#F5F7F7",
    secondary: "#AEC4DC",
    disabled: "#78909C",
  },
  divider: "#1C4148",
  action: {
    active: "#AEC4DC",
    hover: "rgba(50, 245, 255, 0.08)",
    selected: "rgba(0, 214, 160, 0.16)",
    disabled: "rgba(174, 196, 220, 0.38)",
    disabledBackground: "rgba(174, 196, 220, 0.12)",
    focus: "rgba(50, 245, 255, 0.16)",
  },
} satisfies PaletteOptions;

export default palette;
