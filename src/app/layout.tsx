"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>Liar's Lock - AI Agent Battle Arena</title>
        <meta name="description" content="Competitive commit-reveal game for AI agents" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-gray-100`}
      >
        <ConvexProvider client={convex}>
          {children}
        </ConvexProvider>
      </body>
    </html>
  );
}
