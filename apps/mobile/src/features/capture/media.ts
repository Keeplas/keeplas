/**
 * Getting plaintext media onto the phone for a capture: camera / library
 * photos and videos (expo-image-picker), any file (expo-document-picker),
 * and scanned pages bound into one PDF (expo-print). Results are app-cache
 * files; they are sealed into the outbox, then deleted.
 */
import * as Device from "expo-device";
import * as DocumentPicker from "expo-document-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import { File } from "expo-file-system";

import { fileKindOf } from "@/crypto/item-meta";
import { keepUnlockedWhile } from "@/lib/auto-lock";
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

export class CameraUnavailable extends Error {
  constructor() {
    super("CAMERA_UNAVAILABLE");
  }
}

/** Photo or video from the camera; null when the user cancels. */
export async function shoot(
  media: "images" | "videos",
): Promise<CaptureFile | null> {
  if (!Device.isDevice) throw new CameraUnavailable();
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new PermissionDenied("camera");
  const result = await keepUnlockedWhile(() =>
    ImagePicker.launchCameraAsync({
      mediaTypes: [media],
      quality: 0.85,
      videoMaxDuration: 600,
    }),
  );
  return result.canceled ? null : toCaptureFile(result.assets[0]);
}

/** Photos / videos from the library (several at once). */
export async function chooseFromLibrary(
  media: ("images" | "videos")[] = ["images"],
): Promise<CaptureFile[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new PermissionDenied("photos");
  const result = await keepUnlockedWhile(() =>
    ImagePicker.launchImageLibraryAsync({
      mediaTypes: media,
      allowsMultipleSelection: true,
      quality: 0.85,
    }),
  );
  return result.canceled ? [] : result.assets.map(toCaptureFile);
}

/** Any document from Files / Drive. */
export async function chooseFiles(): Promise<CaptureFile[]> {
  const result = await keepUnlockedWhile(() =>
    DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    }),
  );
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

// Scanned pages are downscaled before being embedded in the PDF: a full-res
// camera frame as a base64 data URI is several MB of JS string per page,
// enough to OOM a 2 GB phone on a multi-page scan. ~1600 px keeps A4 text
// readable.
const PDF_PAGE_MAX_PX = 1600;
const PDF_PAGE_JPEG_QUALITY = 0.7;

async function jpegDataUri(
  uri: string,
  width: number,
  quality: number,
): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width });
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: quality,
  });
  const file = new File(result.uri);
  const dataUri = `data:image/jpeg;base64,${await file.base64()}`;
  if (file.uri !== uri) file.delete();
  return dataUri;
}

/** Scanned page photos → one A4 PDF, a page per photo (M07-8 "3 pages · PDF"). */
export async function pagesToPdf(
  pages: string[],
  name: string,
): Promise<CaptureFile> {
  // Sequential on purpose: one downscaled page on the heap at a time.
  const images: string[] = [];
  for (const uri of pages) {
    images.push(await jpegDataUri(uri, PDF_PAGE_MAX_PX, PDF_PAGE_JPEG_QUALITY));
  }
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

export const VIDEO_MAX_PX = 1920;
export const VIDEO_BITRATE = 6_000_000;
export const VIDEO_MIN_BYTES = 8 * 1024 * 1024;
const POSTER_PX = 320;
const POSTER_QUALITY = 0.5;

const asFileUri = (path: string) =>
  path.startsWith("/") ? `file://${path}` : path;

type Compressor = Pick<
  typeof import("react-native-compressor"),
  "Video" | "createVideoThumbnail"
>;

const loadCompressor = (): Promise<Compressor> =>
  import("react-native-compressor");

export async function prepareVideo(
  file: CaptureFile,
  onProgress?: (ratio: number) => void,
  load: () => Promise<Compressor> = loadCompressor,
): Promise<CaptureFile> {
  if (file.kind !== "video") return file;
  try {
    const { Video, createVideoThumbnail } = await load();
    let prepared = file;
    const before = new File(file.uri).size;
    if (before > VIDEO_MIN_BYTES) {
      const output = asFileUri(
        await Video.compress(
          file.uri,
          {
            compressionMethod: "manual",
            maxSize: VIDEO_MAX_PX,
            bitrate: VIDEO_BITRATE,
          },
          (progress) => onProgress?.(progress > 1 ? progress / 100 : progress),
        ),
      );
      const compressed = new File(output);
      if (compressed.exists && compressed.size < before) {
        prepared = {
          ...file,
          uri: output,
          mimeType: "video/mp4",
          name: file.name.replace(/\.[^.]+$/, "") + ".mp4",
        };
      } else if (compressed.exists) {
        compressed.delete();
      }
    }
    const thumbnail = await createVideoThumbnail(prepared.uri);
    const poster = await jpegDataUri(
      asFileUri(thumbnail.path),
      POSTER_PX,
      POSTER_QUALITY,
    );
    return { ...prepared, poster };
  } catch {
    return file;
  }
}
