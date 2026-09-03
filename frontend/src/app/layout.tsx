import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "ATLANTIS — India EEZ Ocean Visualization Platform",
  description:
    "Interactive 3D ocean visualization platform rendering INCOIS/Copernicus numerical model outputs together with real in-situ Argo floats and gliders across India's EEZ.",
  icons: {
    icon: "/atlantis-logo.png",
    apple: "/atlantis-logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        <link rel="icon" href="/atlantis-logo.png" />
      </head>
      <body className="h-full bg-slate-950 text-slate-100 overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
