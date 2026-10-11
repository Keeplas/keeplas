import { QRCodeSVG as QRCode } from "qrcode.react";

// Share of the QR width taken by the Keeplas mark (Figma: 42 / 240).
const LOGO_RATIO = 0.175;

interface QRCodeSVGProps {
  value: string;
  size: number;
}

/**
 * QR code with the Keeplas mark in the centre (W04-2, D-01). Always dark on
 * white, in both themes, so every phone camera can read it.
 */
export function QRCodeSVG({ value, size }: QRCodeSVGProps) {
  const logo = Math.round(size * LOGO_RATIO);
  return (
    <QRCode
      value={value}
      size={size}
      level="Q"
      // White quiet zone: the frame around the code is dark in Noir.
      marginSize={2}
      bgColor="#ffffff"
      fgColor="#0E2340"
      imageSettings={{
        src: "/assets/logo/logo.svg",
        width: logo,
        height: logo,
        excavate: true,
      }}
    />
  );
}
