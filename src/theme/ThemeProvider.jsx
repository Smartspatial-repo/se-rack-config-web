"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { theme } from "./theme";

export default function ThemeProvider({ children }) {
  return <MuiThemeProvider theme={theme}><CssBaseline />{children}</MuiThemeProvider>;
}
