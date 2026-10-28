import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SE Rack Configurator",
  description: "Configure your SE Rack setup easily",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
