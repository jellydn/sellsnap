import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { TextDecoder } from "node:util";
import { logger } from "@sellsnap/logger";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
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
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return `Invalid image extension: ${ext}. Allowed: ${[...ALLOWED_IMAGE_EXTENSIONS].join(", ")}`;
  }
  return null;
}

export function validateProductFile(filename: string): string | null {
  const ext = extname(filename).toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.has(ext)) {
    return `File type not allowed: ${ext}. Allowed: ${[...ALLOWED_FILE_EXTENSIONS].join(", ")}`;
  }
  return null;
}

function uploadError(message: string, statusCode = 400): Error {
  return Object.assign(new Error(message), { statusCode });
}

function byteLimit(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw uploadError("Upload limits are not configured correctly", 503);
  }
  return value;
}

async function validateContent(buffer: Buffer, filename: string): Promise<void> {
  if (buffer.length === 0) throw uploadError("Empty files are not allowed");
  if (buffer.length > byteLimit("MAX_UPLOAD_SIZE", 10 * 1024 * 1024)) {
    throw uploadError("File is too large", 413);
  }
  const ext = extname(filename).slice(1).toLowerCase();
  const detected = await fileTypeFromBuffer(buffer).catch(() => undefined);
  const aliases: Record<string, string[]> = {
    jpg: ["jpg", "jpeg"],
    mov: ["mov", "mp4"],
    // Illustrator uses the PDF container; Sketch uses ZIP.
    pdf: ["pdf", "ai"],
    zip: ["zip", "sketch"],
  };
  if (detected && (aliases[detected.ext] ?? [detected.ext]).includes(ext)) return;

  if (!detected && ["txt", "md", "csv", "json"].includes(ext)) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      if (
        buffer.some(
          (byte) => (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte === 127,
        )
      ) {
        throw new Error("Binary content");
      }
      if (ext === "json") JSON.parse(text);
      return;
    } catch {
      throw uploadError("Invalid text file content");
    }
  }
  throw uploadError("File content does not match its extension or is unsupported");
}

// INSTREAM avoids sharing filesystem paths with the scanner. No upload is published
// unless clamd returns an explicit clean verdict, including when it is unavailable.
async function scanFile(buffer: Buffer): Promise<void> {
  const host = process.env.CLAMAV_HOST;
  const port = Number(process.env.CLAMAV_PORT ?? 3310);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw uploadError("Malware scanning is unavailable", 503);
  }
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host, port });
    let response = "";
    const timeout = setTimeout(() => socket.destroy(new Error("Scanner timeout")), 30_000);
    socket.on("close", () => {
      clearTimeout(timeout);
      reject(uploadError("Malware scanning is unavailable", 503));
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < buffer.length; offset += 64 * 1024) {
        const chunk = buffer.subarray(offset, offset + 64 * 1024);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on("data", (chunk: Buffer) => {
      response += chunk.toString();
      if (response.length > 4096) socket.destroy(new Error("Invalid scanner response"));
      if (response.includes("\0")) socket.end();
    });
    socket.on("error", () => reject(uploadError("Malware scanning is unavailable", 503)));
    socket.on("end", () => {
      if (response.trim().replace(/\0$/, "") === "stream: OK") resolve();
      else if (response.trim().replace(/\0$/, "").endsWith(" FOUND")) {
        reject(uploadError("File rejected by malware scanner"));
      } else reject(uploadError("Malware scanning is unavailable", 503));
    });
  });
}

const MAX_ACTIVE_UPLOADS = 2;
const activeUsers = new Set<string>();

function uploadPath(value: string): string {
  return value.startsWith("/uploads/images/")
    ? resolve(IMAGES_DIR, value.slice("/uploads/images/".length))
    : resolve(value);
}

// The helper holds a kernel lock until stdin closes. Parent termination closes
// the pipe, so neither a server crash nor a leftover lock file can strand a user.
async function lockOwner(owner: string): Promise<() => Promise<void>> {
  const locks = join(UPLOADS_DIR, "locks");
  await mkdir(locks, { recursive: true });
  const child = spawn("flock", ["--no-fork", "-n", "-E", "75", join(locks, owner), "cat"], {
    stdio: ["pipe", "pipe", "ignore"],
  });
  // Process exit is handled below; the pipe can close first on lock rejection.
  child.stdin.on("error", () => {});
  const closed = new Promise<number | null>((resolve) => child.once("close", resolve));
  try {
    await new Promise<void>((resolve, reject) => {
      child.stdout.once("data", () => resolve());
      child.once("error", () => reject(uploadError("Upload locking is unavailable", 503)));
      child.once("close", (code) =>
        reject(
          uploadError(
            code === 75
              ? "Another upload is in progress; retry shortly"
              : "Upload locking is unavailable",
            code === 75 ? 429 : 503,
          ),
        ),
      );
      child.stdin.write("ready");
    });
  } catch (error) {
    child.stdin.end();
    await closed;
    throw error;
  }
  return async () => {
    child.stdin.end();
    await closed;
  };
}

async function removeUnreferenced(paths: Set<string>): Promise<void> {
  for (const path of paths) {
    try {
      const imageUrl = path.startsWith(`${IMAGES_DIR}${sep}`)
        ? `/uploads/images/${relative(IMAGES_DIR, path).split(sep).join("/")}`
        : path;
      const products = await prisma.product.count({
        where: { OR: [{ filePath: path }, { coverImageUrl: imageUrl }] },
      });
      const avatars = await prisma.user.count({ where: { avatarUrl: imageUrl } });
      if (products === 0 && avatars === 0) await unlink(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        logger.warn({ error, path }, "Could not clean up upload; retained for reconciliation");
      }
    }
  }
}

class UploadSession {
  readonly created = new Set<string>();
  readonly replaced = new Set<string>();
  readonly references = new Map<string, number>();
  private used = 0;
  private readonly quota = byteLimit("USER_STORAGE_QUOTA_BYTES", 1024 * 1024 * 1024);

  constructor(private readonly owner: string) {}

  async initialize(userId: string): Promise<void> {
    const paths = new Set<string>();
    for (const root of [IMAGES_DIR, FILES_DIR]) {
      const dir = join(root, this.owner);
      await mkdir(dir, { recursive: true });
      for (const name of await readdir(dir)) paths.add(join(dir, name));
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true, products: { select: { filePath: true, coverImageUrl: true } } },
    });
    for (const value of [
      user?.avatarUrl,
      ...(user?.products ?? []).flatMap((p) => [p.filePath, p.coverImageUrl]),
    ]) {
      if (!value) continue;
      const path = uploadPath(value);
      if (
        ![
          IMAGES_DIR,
          FILES_DIR,
          join(IMAGES_DIR, this.owner),
          join(FILES_DIR, this.owner),
        ].includes(dirname(path))
      )
        continue;
      this.references.set(path, (this.references.get(path) ?? 0) + 1);
      paths.add(path);
    }
    for (const path of paths) this.used += await this.size(path);
  }

  private async size(path: string): Promise<number> {
    try {
      return (await stat(path)).size;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
      throw error;
    }
  }

  async removeAfterCommit(value: string | null | undefined): Promise<void> {
    if (!value) return;
    const path = uploadPath(value);
    if (!this.references.has(path) || this.replaced.has(path)) return;
    if (this.references.get(path) === 1) this.used -= await this.size(path);
    this.replaced.add(path);
  }

  private async checkQuota(bytes: number, replacing?: string | null): Promise<void> {
    const path = replacing ? uploadPath(replacing) : null;
    const credit =
      path && this.references.get(path) === 1 && !this.replaced.has(path)
        ? await this.size(path)
        : 0;
    if (this.used - credit + bytes > this.quota) throw uploadError("Storage quota exceeded", 413);
  }

  private async store(
    buffer: Buffer,
    filename: string,
    image: boolean,
    replacing?: string | null,
  ): Promise<string> {
    await this.checkQuota(buffer.length, replacing);
    const name = `${randomUUID()}${extname(filename).toLowerCase()}`;
    const path = join(image ? IMAGES_DIR : FILES_DIR, this.owner, name);
    this.created.add(path);
    await writeFile(path, buffer, { flag: "wx" });
    this.used += buffer.length;
    await this.removeAfterCommit(replacing);
    return image ? `/uploads/images/${this.owner}/${name}` : path;
  }

  async saveImage(buffer: Buffer, filename: string, replacing?: string | null): Promise<string> {
    await this.checkQuota(buffer.length, replacing);
    const detected = await fileTypeFromBuffer(buffer).catch(() => undefined);
    const error = validateImageFile(detected?.mime ?? "", filename);
    if (error) throw uploadError(error);
    await validateContent(buffer, filename);
    await scanFile(buffer);
    let clean: Buffer;
    try {
      clean = await sharp(buffer, { limitInputPixels: 40_000_000 }).rotate().toBuffer();
    } catch {
      throw uploadError("Invalid image content");
    }
    return this.store(clean, filename, true, replacing);
  }

  async saveFile(buffer: Buffer, filename: string, replacing?: string | null): Promise<string> {
    await this.checkQuota(buffer.length, replacing);
    const error = validateProductFile(filename);
    if (error) throw uploadError(error);
    await validateContent(buffer, filename);
    await scanFile(buffer);
    return this.store(buffer, filename, false, replacing);
  }
}

export async function withUpload<T>(
  userId: string,
  action: (upload: UploadSession) => Promise<T>,
): Promise<T> {
  // Reject instead of queuing request bodies or launching unbounded scanner jobs.
  if (activeUsers.has(userId) || activeUsers.size >= MAX_ACTIVE_UPLOADS) {
    throw uploadError("Upload capacity is busy; retry shortly", 429);
  }
  activeUsers.add(userId);
  let release: (() => Promise<void>) | undefined;
  try {
    const owner = createHash("sha256").update(userId).digest("hex");
    const upload = new UploadSession(owner);
    release = await lockOwner(owner);
    await upload.initialize(userId);
    let result: T;
    try {
      result = await action(upload);
    } catch (error) {
      // A lost database response can mean either commit or rollback. References,
      // not the response, decide which version can safely be removed.
      await removeUnreferenced(new Set([...upload.created, ...upload.replaced]));
      throw error;
    }
    await removeUnreferenced(upload.replaced);
    return result;
  } finally {
    try {
      await release?.();
    } finally {
      activeUsers.delete(userId);
    }
  }
}
