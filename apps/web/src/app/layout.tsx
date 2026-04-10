import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import ConvexClientProvider from "./convex-client-provider";
import "./globals.css";

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
      className={`${manrope.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface text-on-surface font-sans">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
