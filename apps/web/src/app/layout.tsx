import type { Metadata } from "next";
import { Inter, Manrope, Geist } from "next/font/google";
import ConvexClientProvider from "./convex-client-provider";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@keeplas/ui";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Keeplas — Life Continuity Platform",
  description:
    "Securely store, organize, and transmit vital information to trusted contacts. Zero-knowledge encryption, open-source.",
  icons: {
    icon: "/assets/logo/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", manrope.variable, inter.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-full flex flex-col bg-surface text-on-surface font-sans">
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
