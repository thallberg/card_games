import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
