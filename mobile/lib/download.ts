import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { ApiError } from "./api";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function downloadFile(
  path: string,
  token: string,
  filename: string,
  mimeType: string = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
): Promise<void> {
  const res = await fetch(BASE_URL + path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = `Download failed (${res.status})`;
    try {
      message = JSON.parse(text).error ?? message;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message);
  }

  const blob = await res.blob();

  if (Platform.OS === "web") {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const base64 = await blobToBase64(blob);
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: filename });
  }
}
