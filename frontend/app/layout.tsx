import type { Metadata } from "next";
import "./globals.css";
import { ConditionalHeader } from "./ConditionalHeader";

export const metadata: Metadata = {
  title: "Punter App",
  description: "A modern full-stack application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ConditionalHeader />
        {children}
      </body>
    </html>
  );
}

