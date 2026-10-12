import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { prisma } from "./prisma";

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

// ---------------------------------------------------------------------------
// Magic byte validation
// ---------------------------------------------------------------------------

/**
 * A single byte-sequence check: every byte in `bytes` must match the buffer
 * starting at `offset` (default 0).
 */
interface MagicByteCheck {
  bytes: number[];
  offset?: number;
}

/**
 * A compound check: ALL MagicByteChecks must pass (logical AND).
 * Used for formats whose signature spans multiple locations (e.g. WebP = RIFF
 * at offset 0 AND "WEBP" at offset 8).
 */
type CompoundCheck = MagicByteCheck[];

/**
 * A full magic signature: AT LEAST ONE CompoundCheck must pass (logical OR).
 * Used for formats with multiple valid headers (e.g. GIF87a / GIF89a).
 */
type MagicSignature = CompoundCheck[];

// ZIP local-file header (also used by EPUB, XLSX, DOCX, PPTX, FIG, SKETCH)
const ZIP_SIGNATURES: MagicSignature = [
  [{ bytes: [0x50, 0x4b, 0x03, 0x04] }], // standard ZIP local file header
  [{ bytes: [0x50, 0x4b, 0x05, 0x06] }], // empty archive
  [{ bytes: [0x50, 0x4b, 0x07, 0x08] }], // spanned archive
];

/**
 * Known magic-byte signatures keyed by lowercase file extension.
 * Extensions not listed here are skipped (fail-open for text/unknown formats).
 */
const EXTENSION_MAGIC_SIGNATURES: Record<string, MagicSignature> = {
  // ── Images ──────────────────────────────────────────────────────────────
  ".jpg": [[{ bytes: [0xff, 0xd8, 0xff] }]],
  ".jpeg": [[{ bytes: [0xff, 0xd8, 0xff] }]],
  ".png": [[{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }]],
  ".gif": [
    [{ bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }], // GIF87a
    [{ bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }], // GIF89a
  ],
  ".webp": [
    [
      { bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF" at offset 0
      { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // "WEBP" at offset 8
    ],
  ],

  // ── Documents ───────────────────────────────────────────────────────────
  ".pdf": [[{ bytes: [0x25, 0x50, 0x44, 0x46] }]], // %PDF
  ".ai": [
    [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // PDF-based AI (%PDF)
    [{ bytes: [0x25, 0x21, 0x50, 0x53] }], // PostScript-based AI (%!PS)
  ],
  ".psd": [[{ bytes: [0x38, 0x42, 0x50, 0x53] }]], // 8BPS

  // ── ZIP-based formats ────────────────────────────────────────────────────
  ".zip": ZIP_SIGNATURES,
  ".epub": ZIP_SIGNATURES,
  ".xlsx": ZIP_SIGNATURES,
  ".docx": ZIP_SIGNATURES,
  ".pptx": ZIP_SIGNATURES,
  ".fig": ZIP_SIGNATURES,
  ".sketch": ZIP_SIGNATURES,

  // ── Archives ────────────────────────────────────────────────────────────
  ".rar": [
    [{ bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00] }], // RAR4
    [{ bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00] }], // RAR5
  ],
  ".gz": [[{ bytes: [0x1f, 0x8b] }]],
  ".7z": [[{ bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] }]],
  // TAR: "ustar" magic at offset 257 (POSIX/GNU tar)
  ".tar": [[{ bytes: [0x75, 0x73, 0x74, 0x61, 0x72], offset: 257 }]],

  // ── Audio ────────────────────────────────────────────────────────────────
  ".mp3": [
    [{ bytes: [0x49, 0x44, 0x33] }], // ID3 tag
    [{ bytes: [0xff, 0xfb] }], // MPEG-1 Layer 3
    [{ bytes: [0xff, 0xf3] }], // MPEG-2 Layer 3
    [{ bytes: [0xff, 0xf2] }], // MPEG-2.5 Layer 3
  ],
  ".wav": [
    [
      { bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF" at offset 0
      { bytes: [0x57, 0x41, 0x56, 0x45], offset: 8 }, // "WAVE" at offset 8
    ],
  ],
  ".flac": [[{ bytes: [0x66, 0x4c, 0x61, 0x43] }]], // fLaC
  ".aac": [
    [{ bytes: [0xff, 0xf1] }], // ADTS AAC (MPEG-4)
    [{ bytes: [0xff, 0xf9] }], // ADTS AAC (MPEG-2)
    [{ bytes: [0x49, 0x44, 0x33] }], // ID3-tagged AAC
  ],
  ".ogg": [[{ bytes: [0x4f, 0x67, 0x67, 0x53] }]], // OggS

  // ── Video ────────────────────────────────────────────────────────────────
  // MP4 / MOV: ISO Base Media File Format – "ftyp" box always at offset 4
  ".mp4": [[{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }]],
  ".mov": [[{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }]],
  ".avi": [
    [
      { bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF" at offset 0
      { bytes: [0x41, 0x56, 0x49, 0x20], offset: 8 }, // "AVI " at offset 8
    ],
  ],
  ".mkv": [[{ bytes: [0x1a, 0x45, 0xdf, 0xa3] }]], // EBML
  ".webm": [[{ bytes: [0x1a, 0x45, 0xdf, 0xa3] }]], // EBML (same as MKV)

  // ── Fonts ────────────────────────────────────────────────────────────────
  ".ttf": [[{ bytes: [0x00, 0x01, 0x00, 0x00, 0x00] }]],
  ".otf": [[{ bytes: [0x4f, 0x54, 0x54, 0x4f] }]], // OTTO
  ".woff": [[{ bytes: [0x77, 0x4f, 0x46, 0x46] }]], // wOFF
  ".woff2": [[{ bytes: [0x77, 0x4f, 0x46, 0x32] }]], // wOF2

  // Text-based formats (CSV, JSON, TXT, MD) have no reliable magic bytes
  // and are intentionally omitted – extension validation is sufficient.
};

/** Returns true when `buffer` contains the expected `bytes` at `offset`. */
function matchesBytes(buffer: Buffer, check: MagicByteCheck): boolean {
  const offset = check.offset ?? 0;
  if (buffer.length < offset + check.bytes.length) return false;
  return check.bytes.every((byte, i) => buffer[offset + i] === byte);
}

/** Returns true when the buffer matches the given magic signature. */
function matchesMagicSignature(buffer: Buffer, signature: MagicSignature): boolean {
  return signature.some((compound) => compound.every((check) => matchesBytes(buffer, check)));
}

/**
 * Validates image file content against known magic bytes.
 * Returns an error message or null if the content looks valid.
 */
export function validateImageMagicBytes(buffer: Buffer, filename: string): string | null {
  const ext = extname(filename).toLowerCase();
  const signature = EXTENSION_MAGIC_SIGNATURES[ext];
  if (!signature) return null; // No known signature for this extension; skip
  if (!matchesMagicSignature(buffer, signature)) {
    return `File content does not match expected format for ${ext} (magic byte mismatch)`;
  }
  return null;
}

/**
 * Validates product file content against known magic bytes.
 * Returns an error message or null if the content looks valid.
 * Text-based formats (CSV, JSON, TXT, MD) are skipped as they have no magic bytes.
 */
export function validateFileMagicBytes(buffer: Buffer, filename: string): string | null {
  const ext = extname(filename).toLowerCase();
  const signature = EXTENSION_MAGIC_SIGNATURES[ext];
  if (!signature) return null; // No known signature (e.g. text files); skip
  if (!matchesMagicSignature(buffer, signature)) {
    return `File content does not match expected format for ${ext} (magic byte mismatch)`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-user storage quota
// ---------------------------------------------------------------------------

/** Default per-user storage quota – overridable via STORAGE_QUOTA_BYTES env var */
export const DEFAULT_STORAGE_QUOTA_BYTES = process.env.STORAGE_QUOTA_BYTES
  ? parseInt(process.env.STORAGE_QUOTA_BYTES, 10)
  : 1 * 1024 * 1024 * 1024; // 1 GB

/**
 * Returns the total bytes currently stored on disk for all product files
 * belonging to `userId`. Files missing from disk are silently skipped.
 */
export async function getUserStorageUsageBytes(userId: string): Promise<number> {
  const products = await prisma.product.findMany({
    where: { creatorId: userId },
    select: { filePath: true },
  });

  let totalBytes = 0;
  for (const product of products) {
    try {
      const stats = statSync(product.filePath);
      totalBytes += stats.size;
    } catch {
      // File may have been removed from disk; skip it
    }
  }
  return totalBytes;
}

/**
 * Checks whether adding `newFilesSize` bytes would exceed `quotaBytes` for
 * the given user. Pass `existingFileSizeToReplace` when replacing an existing
 * file so the old size is subtracted before comparing. Returns an error
 * message when the quota is exceeded, or null when within limits.
 */
export async function checkStorageQuota(
  userId: string,
  newFilesSize: number,
  quotaBytes: number = DEFAULT_STORAGE_QUOTA_BYTES,
  existingFileSizeToReplace = 0,
): Promise<string | null> {
  const used = await getUserStorageUsageBytes(userId);
  const effectiveUsed = Math.max(0, used - existingFileSizeToReplace);
  if (effectiveUsed + newFilesSize > quotaBytes) {
    const usedMB = (used / (1024 * 1024)).toFixed(1);
    const quotaMB = Math.round(quotaBytes / (1024 * 1024));
    return `Storage quota exceeded. Used: ${usedMB} MB of ${quotaMB} MB limit`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Directory helpers
// ---------------------------------------------------------------------------

export function ensureUploadDirs(): void {
  if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });
  if (!existsSync(FILES_DIR)) mkdirSync(FILES_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Metadata / MIME validation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Save helpers
// ---------------------------------------------------------------------------

export async function saveImage(buffer: Buffer, filename: string): Promise<string> {
  const ext = extname(filename || ".jpg") || ".jpg";
  const imageName = `${randomUUID()}${ext}`;
  const imagePath = join(IMAGES_DIR, imageName);
  writeFileSync(imagePath, buffer);
  return `/uploads/images/${imageName}`;
}

export async function saveFile(buffer: Buffer, filename: string): Promise<string> {
  const ext = extname(filename || ".pdf") || ".pdf";
  const newFileName = `${randomUUID()}${ext}`;
  const filePath = join(FILES_DIR, newFileName);
  writeFileSync(filePath, buffer);
  return filePath;
}
