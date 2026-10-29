import * as Device from "expo-device";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import { CameraUnavailable, PermissionDenied } from "@/features/capture/media";
import { keepUnlockedWhile } from "@/lib/auto-lock";
import { uploadFile } from "@/lib/files";

export type AvatarSource = "camera" | "library";

export const AVATAR_PX = 512;
export const AVATAR_QUALITY = 0.8;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export class AvatarTooLarge extends Error {
  constructor() {
    super("AVATAR_TOO_LARGE");
  }
}

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 1,
};

async function launch(
  source: AvatarSource,
): Promise<ImagePicker.ImagePickerResult> {
  if (source === "camera") {
    if (!Device.isDevice) throw new CameraUnavailable();
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new PermissionDenied("camera");
    return keepUnlockedWhile(() =>
      ImagePicker.launchCameraAsync(PICKER_OPTIONS),
    );
  }
  if (Platform.OS !== "android") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new PermissionDenied("photos");
  }
  return keepUnlockedWhile(() =>
    ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS),
  );
}

export async function pickAvatar(source: AvatarSource): Promise<string | null> {
  const result = await launch(source);
  if (result.canceled) return null;
  const context = ImageManipulator.manipulate(result.assets[0].uri);
  context.resize({ width: AVATAR_PX, height: AVATAR_PX });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: AVATAR_QUALITY,
  });
  return saved.uri;
}

export async function uploadAvatar(
  uri: string,
  getUploadUrl: () => Promise<string>,
): Promise<string> {
  const file = new File(uri);
  try {
    if (file.size > MAX_AVATAR_BYTES) throw new AvatarTooLarge();
    return await uploadFile(
      await getUploadUrl(),
      uri,
      () => undefined,
      "image/jpeg",
    );
  } finally {
    if (file.exists) file.delete();
  }
}
