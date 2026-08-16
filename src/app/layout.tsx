import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bop",
  description: "For when you are bopping around town from place to place.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
