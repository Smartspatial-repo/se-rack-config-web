This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

## MUI theme

The root layout wraps every route with MUI's Next.js App Router cache provider,
the shared theme provider, and `CssBaseline`. No per-page provider is needed.

The screenshot-inspired dark palette is defined in
[`src/theme/palette/palette.ts`](src/theme/palette/palette.ts), with cyan
`primary`, teal `secondary`, lime `success`, dark backgrounds, and muted blue
secondary text. Warning and error colors are complementary additions for UI
feedback. Typography and component defaults live in
[`src/theme/theme.ts`](src/theme/theme.ts).

Use MUI components in Client Components to access theme colors through `sx`:

```tsx
"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

export default function Controls() {
  return (
    <Box sx={{ bgcolor: "background.paper", color: "text.primary", p: 3 }}>
      <Button variant="outlined" color="primary">
        Talk to agent
      </Button>
    </Box>
  );
}
```

For computed styles, import `useTheme` from `@mui/material/styles` inside a
Client Component. The palette and theme are also available through
`@theme/palette/palette` and `@theme/theme`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
