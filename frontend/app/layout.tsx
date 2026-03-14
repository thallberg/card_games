/** Kortspel – root layout */
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { LayoutClient } from "@/components/layout-client";

export const metadata: Metadata = {
  title: "Kortspel",
  description: "Kortspelsapplikation",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body className="antialiased">
        <LayoutClient>{children}</LayoutClient>
        <Toaster richColors position="top-center" closeButton />
      </body>
    </html>
  );
}
