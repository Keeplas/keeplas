import type { Metadata } from "next";
import { SecurityContent } from "./security-content";

export const metadata: Metadata = {
  title: "Security & Zero-Knowledge — Keeplas",
  description:
    "How Keeplas keeps your vault private — authentication, zero-knowledge encryption, device unlock, recovery, and the legally-admissible audit trail.",
};

export default function SecurityPage() {
  return <SecurityContent />;
}
