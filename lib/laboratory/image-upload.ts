import { IMAGE_FORMATS, type ImageFormat } from "./types";

/**
 * Shared rules for `image` questions — pure, imported by both the parser, the
 * upload route and the browser component, so the size/format limits a student
 * sees are exactly the ones the server enforces.
 */

/** Default `max-size` when the placeholder doesn't set one. */
export const DEFAULT_IMAGE_MAX_SIZE_MB = 1;

/** Hard ceiling for `max-size`: an author can lower the limit, but not lift it past this. */
export const IMAGE_MAX_SIZE_CEILING_MB = 10;

export const IMAGE_FORMAT_INFO: Record<ImageFormat, { mime: string; extensions: string[]; label: string }> = {
  jpg: { mime: "image/jpeg", extensions: ["jpg", "jpeg"], label: "JPG" },
  png: { mime: "image/png", extensions: ["png"], label: "PNG" },
  gif: { mime: "image/gif", extensions: ["gif"], label: "GIF" },
  webp: { mime: "image/webp", extensions: ["webp"], label: "WEBP" },
};

/** Maps a `formats="..."` entry (case-insensitive, `jpeg` accepted as `jpg`) to a known format. */
export function normalizeImageFormat(raw: string): ImageFormat | null {
  const value = raw.trim().toLowerCase();
  if (value === "jpeg") return "jpg";
  return (IMAGE_FORMATS as readonly string[]).includes(value) ? (value as ImageFormat) : null;
}

export function megabytesToBytes(mb: number): number {
  return Math.floor(mb * 1024 * 1024);
}

/** "512 KB", "1.4 MB" — for messages shown to the student. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

export function imageFormatsLabel(formats: ImageFormat[]): string {
  return formats.map((f) => IMAGE_FORMAT_INFO[f].label).join(", ");
}

/** Value for an `<input type="file" accept>` covering exactly these formats. */
export function imageAcceptAttribute(formats: ImageFormat[]): string {
  return formats
    .flatMap((f) => [IMAGE_FORMAT_INFO[f].mime, ...IMAGE_FORMAT_INFO[f].extensions.map((e) => `.${e}`)])
    .join(",");
}

export function imageFormatFromMime(mime: string): ImageFormat | null {
  const entry = Object.entries(IMAGE_FORMAT_INFO).find(([, info]) => info.mime === mime.toLowerCase());
  return entry ? (entry[0] as ImageFormat) : null;
}

/**
 * Identifies the real format from the file's leading bytes. The server trusts
 * only this — never the declared Content-Type or the file name, which the
 * client controls.
 */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  const startsWith = (sig: number[], offset = 0) =>
    bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);

  if (startsWith([0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || startsWith([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return "gif";
  // RIFF....WEBP
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}

/** Message shown when a file exceeds the question's limit — same text on client and server. */
export function imageTooLargeMessage(sizeBytes: number, maxSizeMb: number): string {
  return `La imagen pesa ${formatFileSize(sizeBytes)} y el máximo permitido es ${formatFileSize(
    megabytesToBytes(maxSizeMb)
  )}. No se puede publicar una imagen de ese tamaño; redúcela o comprímela e inténtalo de nuevo.`;
}

export function imageFormatNotAllowedMessage(formats: ImageFormat[]): string {
  return `Formato no permitido. Solo se aceptan imágenes ${imageFormatsLabel(formats)}.`;
}

/**
 * Every object for one question of one submission lives under this prefix.
 * Read routes refuse any stored value outside it, so an answer value forged
 * through the generic autosave endpoint can never point at someone else's file.
 */
export function imageStoragePrefix(labId: string, submissionId: string, questionId: string): string {
  return `laboratories/${labId}/${submissionId}/${encodeURIComponent(questionId)}/`;
}
