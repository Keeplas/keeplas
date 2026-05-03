"use client";

import { QRCodeSVG as QRCode } from "qrcode.react";

interface QRCodeSVGProps {
  value: string;
  size?: number;
}

export function QRCodeSVG({ value, size = 128 }: QRCodeSVGProps) {
  return (
    <QRCode
      value={value}
      size={size}
      level="M"
      bgColor="#ffffff"
      fgColor="#041632"
      className="rounded-lg"
    />
  );
}
