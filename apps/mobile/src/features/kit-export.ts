/**
 * Recovery kit files: an A4 PDF (expo-print) and a PNG of the on-screen kit
 * card (react-native-view-shot), handed to the share sheet (Save to Files,
 * Print, Photos…), then deleted from the app cache.
 */
import type { RefObject } from "react";
import type { View } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";
import { captureRef } from "react-native-view-shot";
import QRCode from "qrcode";

import { encodeKitQr } from "./kit-qr";

export interface KitLabels {
  title: string;
  created: string;
  qr: string;
  rules: string[];
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

/** Printable A4 page: title, date, the numbered words in two columns, rules. */
export function kitPdfHtml(
  phrase: string[],
  labels: KitLabels,
  qrSvg: string,
): string {
  const words = phrase
    .map(
      (word, index) =>
        `<div class="w"><small>${String(index + 1).padStart(2, "0")}</small>${escapeHtml(word)}</div>`,
    )
    .join("");
  const rules = labels.rules
    .map((rule) => `<li>${escapeHtml(rule)}</li>`)
    .join("");
  return `<html><head><meta charset="utf-8"><style>
    @page { margin: 48px; }
    body { font-family: -apple-system, Roboto, sans-serif; color: #0E2340; }
    .brand { font: 600 22px Georgia, serif; }
    h1 { font: 600 30px Georgia, serif; margin: 24px 0 4px; }
    .meta { color: #5E6E83; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin: 24px 0; padding: 20px; border: 1px solid #E3E7EC; border-radius: 12px; }
    .w { font-size: 17px; font-weight: 600; }
    .w small { display: inline-block; width: 28px; color: #8A97A8; font-weight: 400; font-size: 13px; }
    li { color: #3A4A60; font-size: 13px; line-height: 20px; }
    .qr { display: flex; align-items: center; gap: 20px; margin: 0 0 24px; }
    .qr svg { width: 120px; height: 120px; flex: none; }
    .qr p { color: #3A4A60; font-size: 13px; line-height: 20px; margin: 0; }
  </style></head><body>
    <div class="brand">Keeplas</div>
    <h1>${escapeHtml(labels.title)}</h1>
    <div class="meta">${escapeHtml(labels.created)}</div>
    <div class="grid">${words}</div>
    <div class="qr">${qrSvg}<p>${escapeHtml(labels.qr)}</p></div>
    <ul>${rules}</ul>
  </body></html>`;
}

async function shareThenDelete(
  uri: string,
  options: Sharing.SharingOptions,
): Promise<void> {
  const file = new File(uri);
  try {
    await Sharing.shareAsync(uri, options);
  } finally {
    if (file.exists) file.delete();
  }
}

export async function shareKitPdf(
  phrase: string[],
  labels: KitLabels,
): Promise<void> {
  const qrSvg = await QRCode.toString(encodeKitQr(phrase), {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
  });
  const { uri } = await Print.printToFileAsync({
    html: kitPdfHtml(phrase, labels, qrSvg),
    width: 595,
    height: 842,
  });
  await shareThenDelete(uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: labels.title,
  });
}

export async function shareKitImage(
  card: RefObject<View | null>,
  title: string,
): Promise<void> {
  const uri = await captureRef(card, {
    format: "png",
    quality: 1,
    result: "tmpfile",
    // iOS: the words screen blocks screenshots (useNoScreenCapture), which
    // blanks the default system snapshot; drawing the layer still works.
    useRenderInContext: true,
  });
  await shareThenDelete(uri, {
    mimeType: "image/png",
    UTI: "public.png",
    dialogTitle: title,
  });
}
