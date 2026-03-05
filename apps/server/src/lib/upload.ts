import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const UPLOADS_DIR = join(process.cwd(), "uploads");
export const IMAGES_DIR = join(UPLOADS_DIR, "images");
export const FILES_DIR = join(UPLOADS_DIR, "files");

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);

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

export async function saveImage(file: AsyncIterable<Buffer>, filename: string): Promise<string> {
  const ext = extname(filename || ".jpg") || ".jpg";
  const imageName = `${randomUUID()}${ext}`;
  const imagePath = join(IMAGES_DIR, imageName);
  const buffers: Buffer[] = [];
  for await (const chunk of file) {
    buffers.push(chunk);
  }
  writeFileSync(imagePath, Buffer.concat(buffers));
  return `/uploads/images/${imageName}`;
}

export async function saveFile(file: AsyncIterable<Buffer>, filename: string): Promise<string> {
  const ext = extname(filename || ".pdf") || ".pdf";
  const newFileName = `${randomUUID()}${ext}`;
  const filePath = join(FILES_DIR, newFileName);
  const buffers: Buffer[] = [];
  for await (const chunk of file) {
    buffers.push(chunk);
  }
  writeFileSync(filePath, Buffer.concat(buffers));
  return filePath;
}
