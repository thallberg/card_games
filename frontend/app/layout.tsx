/** Kortspel – root layout */
import type { Metadata } from "next";
import "./globals.css";
import { LayoutClient } from "@/components/layout-client";

export const metadata: Metadata = {
  title: "Kortspel",
  description: "Kortspelsapplikation",
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
      </body>
    </html>
  );
}
