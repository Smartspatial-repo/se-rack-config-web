import type { CSSProperties } from "react";
import type { ThemeOptions } from "@mui/material/styles";

// Keep this module imported by theme.ts so the augmentation is included by TS.
declare module "@mui/material/styles" {
  interface TypographyVariants {
    heading: CSSProperties;
    subheading: CSSProperties;
    body: CSSProperties;
  }

  interface TypographyVariantsOptions {
    heading?: CSSProperties;
    subheading?: CSSProperties;
    body?: CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    heading: true;
    subheading: true;
    body: true;
  }
}

export const fontFamily = "var(--font-montserrat), Arial, Helvetica, sans-serif";

const heading = {
  fontSize: "clamp(2rem, 1.45rem + 1.6vw, 2.75rem)",
  fontWeight: 600,
  lineHeight: 1.2,
  letterSpacing: "-0.035em",
} satisfies CSSProperties;

const subheading = {
  fontSize: "clamp(1.125rem, 1rem + 0.35vw, 1.375rem)",
  fontWeight: 600,
  lineHeight: 1.4,
  letterSpacing: "-0.02em",
} satisfies CSSProperties;

const body = {
  fontSize: "clamp(0.875rem, 0.825rem + 0.2vw, 1rem)",
  fontWeight: 400,
  lineHeight: 1.65,
  letterSpacing: "0em",
} satisfies CSSProperties;

/** Fluid rem-based sizes preserve browser font scaling and avoid JS resizing. */
export const typography = {
  fontFamily,
  htmlFontSize: 16,
  fontSize: 14,
  fontWeightLight: 400,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700,
  heading,
  subheading,
  body,
  h1: heading,
  h2: {
    ...heading,
    fontSize: "clamp(1.75rem, 1.35rem + 1.1vw, 2.25rem)",
    lineHeight: 1.25,
  },
  h3: {
    ...heading,
    fontSize: "clamp(1.5rem, 1.2rem + 0.8vw, 1.875rem)",
    lineHeight: 1.3,
  },
  h4: {
    ...subheading,
    fontSize: "clamp(1.25rem, 1.1rem + 0.45vw, 1.5rem)",
  },
  h5: subheading,
  h6: {
    ...subheading,
    fontSize: "clamp(1rem, 0.95rem + 0.2vw, 1.125rem)",
  },
  subtitle1: {
    ...body,
    fontSize: "clamp(1rem, 0.95rem + 0.2vw, 1.125rem)",
    fontWeight: 500,
  },
  subtitle2: { ...body, fontWeight: 600 },
  body1: body,
  body2: {
    ...body,
    fontSize: "clamp(0.8125rem, 0.775rem + 0.15vw, 0.875rem)",
  },
  button: {
    fontFamily,
    fontSize: "clamp(0.875rem, 0.825rem + 0.15vw, 0.9375rem)",
    fontWeight: 600,
    lineHeight: 1.5,
    letterSpacing: 0,
    textTransform: "none",
  },
  caption: {
    fontSize: "clamp(0.75rem, 0.725rem + 0.1vw, 0.8125rem)",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "0.01em",
  },
  overline: {
    fontSize: "clamp(0.6875rem, 0.65rem + 0.15vw, 0.75rem)",
    fontWeight: 500,
    lineHeight: 1.6,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
} satisfies NonNullable<ThemeOptions["typography"]>;

export default typography;
