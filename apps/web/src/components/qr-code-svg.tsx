import type { ReactNode } from "react";
import { QRCodeSVG as QRCode } from "qrcode.react";

// Share of the QR width taken by the Keeplas mark (Figma: 42 / 240).
const LOGO_RATIO = 0.175;
// W06-7 lock badge: 40 / 200.
const BADGE_RATIO = 0.2;
const EMPTY_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

interface QRCodeSVGProps {
  value: string;
  size: number;
  /** Drawn in the centre instead of the Keeplas mark (W06-7 lock). */
  badge?: ReactNode;
}

/**
 * QR code with the Keeplas mark in the centre (W04-2, D-01), or a badge
 * (W06-7). Always dark on white, in both themes, so every phone camera can
 * read it.
 */
export function QRCodeSVG({ value, size, badge }: QRCodeSVGProps) {
  const center = Math.round(size * (badge ? BADGE_RATIO : LOGO_RATIO));
  const code = (
    <QRCode
      value={value}
      size={size}
      level="Q"
      // White quiet zone: the frame around the code is dark in Noir.
      marginSize={2}
      bgColor="#ffffff"
      fgColor="#0E2340"
      imageSettings={{
        // With a badge, the centre is only cleared; the badge sits on top.
        src: badge ? EMPTY_PIXEL : "/assets/logo/logo.svg",
        width: center,
        height: center,
        excavate: true,
      }}
    />
  );
  if (!badge) return code;
  return (
    <span className="relative inline-flex">
      {code}
      <span className="absolute inset-0 flex items-center justify-center">
        {badge}
      </span>
    </span>
  );
}
