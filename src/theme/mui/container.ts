import type { Components, Theme } from "@mui/material/styles";

// Container has no built-in variant prop, so extend its own props directly.
declare module "@mui/material/Container" {
  interface ContainerOwnProps {
    variant?: "custom";
  }
}

export const container: Components<Theme>["MuiContainer"] = {
  variants: [
    {
      props: { variant: "custom" },
      style: ({ theme }) => ({
        width: "100%",
        maxWidth: 1400,
        minWidth: 0,
        boxSizing: "border-box",
        marginLeft: "auto",
        marginRight: "auto",
        paddingLeft: theme.spacing(2),
        paddingRight: theme.spacing(2),
        [theme.breakpoints.up("sm")]: {
          paddingLeft: theme.spacing(3),
          paddingRight: theme.spacing(3),
        },
        [theme.breakpoints.up("md")]: {
          paddingLeft: theme.spacing(4),
          paddingRight: theme.spacing(4),
        },
        [theme.breakpoints.up("xl")]: {
          paddingLeft: theme.spacing(5),
          paddingRight: theme.spacing(5),
        },
      }),
    },
  ],
};

export default container;
