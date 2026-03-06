import { randomUUID } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const UPLOADS_DIR = join(process.cwd(), "uploads");
export const IMAGES_DIR = join(UPLOADS_DIR, "images");
export const FILES_DIR = join(UPLOADS_DIR, "files");

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

const ALLOWED_FILE_EXTENSIONS = new Set([
  ".pdf",
  ".epub",
  ".mobi",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".mp3",
  ".wav",
  ".flac",
  ".aac",
  ".ogg",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".psd",
  ".ai",
  ".fig",
  ".sketch",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".csv",
  ".xlsx",
  ".docx",
  ".pptx",
  ".json",
  ".txt",
  ".md",
]);

export function ensureUploadDirs(): void {
  if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });
  if (!existsSync(FILES_DIR)) mkdirSync(FILES_DIR, { recursive: true });
}

export function validateImageFile(mimetype: string, filename: string): string | null {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimetype)) {
    return `Invalid image type: ${mimetype}. Allowed: ${[...ALLOWED_IMAGE_MIME_TYPES].join(", ")}`;
  }
  const ext = extname(filename).toLowerCase();
  if (ext && !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return `Invalid image extension: ${ext}. Allowed: ${[...ALLOWED_IMAGE_EXTENSIONS].join(", ")}`;
  }
  return null;
}

export function validateProductFile(filename: string): string | null {
  const ext = extname(filename).toLowerCase();
  if (ext && !ALLOWED_FILE_EXTENSIONS.has(ext)) {
    return `File type not allowed: ${ext}. Allowed: ${[...ALLOWED_FILE_EXTENSIONS].join(", ")}`;
  }
  return null;
}

export async function saveImage(file: AsyncIterable<Buffer>, filename: string): Promise<string> {
  const ext = extname(filename || ".jpg") || ".jpg";
  const imageName = `${randomUUID()}${ext}`;
  const imagePath = join(IMAGES_DIR, imageName);
  await pipeline(Readable.from(file), createWriteStream(imagePath));
  return `/uploads/images/${imageName}`;
}

export async function saveFile(file: AsyncIterable<Buffer>, filename: string): Promise<string> {
  const ext = extname(filename || ".pdf") || ".pdf";
  const newFileName = `${randomUUID()}${ext}`;
  const filePath = join(FILES_DIR, newFileName);
  await pipeline(Readable.from(file), createWriteStream(filePath));
  return filePath;
}
