/**
 * Getting plaintext media onto the phone for a capture: camera / library
 * photos and videos (expo-image-picker), any file (expo-document-picker),
 * and scanned pages bound into one PDF (expo-print). Results are app-cache
 * files; they are sealed into the outbox, then deleted.
 */
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import { File } from "expo-file-system";

import { fileKindOf } from "@/crypto/item-meta";
import type { CaptureFile } from "./seal";

export type PermissionProblem = "camera" | "photos" | "microphone";

export class PermissionDenied extends Error {
  constructor(readonly what: PermissionProblem) {
    super(`PERMISSION_${what.toUpperCase()}`);
  }
}

function toCaptureFile(asset: ImagePicker.ImagePickerAsset): CaptureFile {
  const mimeType =
    asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");
  return {
    uri: asset.uri,
    name: asset.fileName ?? asset.uri.split("/").pop() ?? "capture",
    mimeType,
    kind: fileKindOf(mimeType),
    durationSec:
      asset.type === "video" && asset.duration
        ? Math.round(asset.duration / 1000)
        : undefined,
  };
}

/** Photo or video from the camera; null when the user cancels. */
export async function shoot(
  media: "images" | "videos",
): Promise<CaptureFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new PermissionDenied("camera");
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: [media],
    quality: 0.85,
    videoMaxDuration: 600,
  });
  return result.canceled ? null : toCaptureFile(result.assets[0]);
}

/** Photos / videos from the library (several at once). */
export async function chooseFromLibrary(
  media: ("images" | "videos")[] = ["images"],
): Promise<CaptureFile[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new PermissionDenied("photos");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: media,
    allowsMultipleSelection: true,
    quality: 0.85,
  });
  return result.canceled ? [] : result.assets.map(toCaptureFile);
}

/** Any document from Files / Drive. */
export async function chooseFiles(): Promise<CaptureFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => {
    const mimeType = asset.mimeType ?? "application/octet-stream";
    return {
      uri: asset.uri,
      name: asset.name,
      mimeType,
      kind: fileKindOf(mimeType),
    };
  });
}

/** Scanned page photos → one A4 PDF, a page per photo (M07-8 "3 pages · PDF"). */
export async function pagesToPdf(
  pages: string[],
  name: string,
): Promise<CaptureFile> {
  const images = await Promise.all(
    pages.map(
      async (uri) => `data:image/jpeg;base64,${await new File(uri).base64()}`,
    ),
  );
  const html = `<html><head><style>
    @page { margin: 0; }
    body { margin: 0; }
    img { width: 100%; height: 100vh; object-fit: contain; page-break-after: always; display: block; }
  </style></head><body>${images.map((src) => `<img src="${src}" />`).join("")}</body></html>`;
  const { uri } = await Print.printToFileAsync({
    html,
    width: 595,
    height: 842,
  });
  return {
    uri,
    name: `${name.replace(/[/\\]/g, "-") || "Scan"}.pdf`,
    mimeType: "application/pdf",
    kind: "document",
  };
}
