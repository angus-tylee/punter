import type { Metadata } from "next";
import "./globals.css";
import { AuthHeader } from "./AuthHeader";

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
        <header className="w-full border-b border-gray-200 dark:border-gray-800">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
            <a href="/" className="font-semibold">Punter</a>
            <AuthHeader />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

