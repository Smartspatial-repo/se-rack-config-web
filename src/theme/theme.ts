import { createTheme } from "@mui/material/styles";
import { components } from "./mui/components";
import { typography } from "./mui/typography";
import { palette } from "./palette/palette";

export const theme = createTheme({
  palette,
  typography,
  shape: { borderRadius: 10 },
  components,
});

export default theme;
