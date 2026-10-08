import { describe, expect, it, vi } from "vitest";
import {
  checkStorageQuota,
  DEFAULT_STORAGE_QUOTA_BYTES,
  getUserStorageUsageBytes,
  saveFile,
  saveImage,
  validateFileMagicBytes,
  validateImageFile,
  validateImageMagicBytes,
  validateProductFile,
} from "../upload";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    statSync: vi.fn(() => ({ size: 1024 * 1024 })), // 1 MB per file by default
  };
});

vi.mock("node:crypto", () => ({
  randomUUID: () => "test-uuid",
}));

vi.mock("../prisma", () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
    },
  },
}));

describe("validateImageFile", () => {
  it("returns null for valid image/jpeg with .jpg", () => {
    expect(validateImageFile("image/jpeg", "photo.jpg")).toBeNull();
  });

  it("returns null for valid image/png with .png", () => {
    expect(validateImageFile("image/png", "photo.png")).toBeNull();
  });

  it("returns null for valid image/gif with .gif", () => {
    expect(validateImageFile("image/gif", "anim.gif")).toBeNull();
  });

  it("returns null for valid image/webp with .webp", () => {
    expect(validateImageFile("image/webp", "photo.webp")).toBeNull();
  });

  it("returns error for invalid MIME type", () => {
    const result = validateImageFile("application/pdf", "file.pdf");
    expect(result).toContain("Invalid image type");
    expect(result).toContain("application/pdf");
  });

  it("returns error for invalid extension", () => {
    const result = validateImageFile("image/jpeg", "file.exe");
    expect(result).toContain("Invalid image extension");
    expect(result).toContain(".exe");
  });

  it("returns null when extension is empty", () => {
    expect(validateImageFile("image/jpeg", "noextension")).toBeNull();
  });

  it("rejects SVG MIME type for security (XSS prevention)", () => {
    const result = validateImageFile("image/svg+xml", "graphic.svg");
    expect(result).toContain("Invalid image type");
    expect(result).toContain("image/svg+xml");
  });

  it("rejects SVG extension even with valid MIME type", () => {
    const result = validateImageFile("image/jpeg", "malicious.svg");
    expect(result).toContain("Invalid image extension");
    expect(result).toContain(".svg");
  });
});

describe("validateProductFile", () => {
  it("returns null for allowed file types", () => {
    expect(validateProductFile("document.pdf")).toBeNull();
    expect(validateProductFile("archive.zip")).toBeNull();
    expect(validateProductFile("song.mp3")).toBeNull();
  });

  it("returns error for disallowed file types", () => {
    const result = validateProductFile("script.exe");
    expect(result).toContain("File type not allowed");
    expect(result).toContain(".exe");
  });

  it("returns null when extension is empty", () => {
    expect(validateProductFile("noextension")).toBeNull();
  });
});

describe("saveImage", () => {
  it("saves buffer and returns URL path starting with /uploads/images/", async () => {
    const buffer = Buffer.from("image-data");
    const result = await saveImage(buffer, "photo.jpg");

    expect(result).toBe("/uploads/images/test-uuid.jpg");
  });
});

describe("saveFile", () => {
  it("saves buffer and returns absolute file path", async () => {
    const buffer = Buffer.from("file-data");
    const result = await saveFile(buffer, "document.pdf");

    expect(result).toContain("test-uuid.pdf");
    expect(result).toContain("files");
  });
});

// ---------------------------------------------------------------------------
// validateImageMagicBytes
// ---------------------------------------------------------------------------

describe("validateImageMagicBytes", () => {
  it("returns null for a valid JPEG buffer", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(validateImageMagicBytes(buffer, "photo.jpg")).toBeNull();
  });

  it("returns null for a valid JPEG buffer with .jpeg extension", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(validateImageMagicBytes(buffer, "photo.jpeg")).toBeNull();
  });

  it("returns null for a valid PNG buffer", () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(validateImageMagicBytes(buffer, "image.png")).toBeNull();
  });

  it("returns null for a valid GIF87a buffer", () => {
    const buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
    expect(validateImageMagicBytes(buffer, "anim.gif")).toBeNull();
  });

  it("returns null for a valid GIF89a buffer", () => {
    const buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(validateImageMagicBytes(buffer, "anim.gif")).toBeNull();
  });

  it("returns null for a valid WebP buffer", () => {
    // RIFF at 0, WEBP at offset 8
    const buffer = Buffer.alloc(12);
    buffer.write("RIFF", 0, "ascii");
    buffer.write("WEBP", 8, "ascii");
    expect(validateImageMagicBytes(buffer, "photo.webp")).toBeNull();
  });

  it("returns error when JPEG buffer contains wrong magic bytes", () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG bytes in a .jpg file
    const result = validateImageMagicBytes(buffer, "fake.jpg");
    expect(result).toContain("magic byte mismatch");
    expect(result).toContain(".jpg");
  });

  it("returns error when PNG buffer contains wrong magic bytes", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff]); // JPEG bytes in a .png file
    const result = validateImageMagicBytes(buffer, "fake.png");
    expect(result).toContain("magic byte mismatch");
  });

  it("returns null for extensions without a defined signature (e.g. no-extension file)", () => {
    const buffer = Buffer.from([0x00, 0x00]);
    expect(validateImageMagicBytes(buffer, "noextension")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateFileMagicBytes
// ---------------------------------------------------------------------------

describe("validateFileMagicBytes", () => {
  it("returns null for a valid PDF buffer", () => {
    const buffer = Buffer.from("%PDF-1.4 ...", "ascii");
    expect(validateFileMagicBytes(buffer, "doc.pdf")).toBeNull();
  });

  it("returns error when PDF buffer has wrong magic bytes", () => {
    const buffer = Buffer.from("Not a PDF file content here");
    const result = validateFileMagicBytes(buffer, "fake.pdf");
    expect(result).toContain("magic byte mismatch");
    expect(result).toContain(".pdf");
  });

  it("returns null for a valid ZIP buffer (.zip extension)", () => {
    const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);
    expect(validateFileMagicBytes(buffer, "archive.zip")).toBeNull();
  });

  it("returns null for a valid ZIP buffer (.docx extension)", () => {
    const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);
    expect(validateFileMagicBytes(buffer, "document.docx")).toBeNull();
  });

  it("returns null for a valid ZIP buffer (.epub extension)", () => {
    const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);
    expect(validateFileMagicBytes(buffer, "book.epub")).toBeNull();
  });

  it("returns null for a valid GZip buffer", () => {
    const buffer = Buffer.from([0x1f, 0x8b, 0x08]);
    expect(validateFileMagicBytes(buffer, "file.gz")).toBeNull();
  });

  it("returns null for a valid FLAC buffer", () => {
    const buffer = Buffer.from([0x66, 0x4c, 0x61, 0x43]); // fLaC
    expect(validateFileMagicBytes(buffer, "audio.flac")).toBeNull();
  });

  it("returns null for a valid OGG buffer", () => {
    const buffer = Buffer.from([0x4f, 0x67, 0x67, 0x53]); // OggS
    expect(validateFileMagicBytes(buffer, "audio.ogg")).toBeNull();
  });

  it("returns null for a valid MKV/WEBM buffer", () => {
    const buffer = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]); // EBML
    expect(validateFileMagicBytes(buffer, "video.mkv")).toBeNull();
    expect(validateFileMagicBytes(buffer, "video.webm")).toBeNull();
  });

  it("returns null for a valid WOFF buffer", () => {
    const buffer = Buffer.from([0x77, 0x4f, 0x46, 0x46]); // wOFF
    expect(validateFileMagicBytes(buffer, "font.woff")).toBeNull();
  });

  it("returns null for a valid WOFF2 buffer", () => {
    const buffer = Buffer.from([0x77, 0x4f, 0x46, 0x32]); // wOF2
    expect(validateFileMagicBytes(buffer, "font.woff2")).toBeNull();
  });

  it("returns null for text-based formats without magic bytes (CSV)", () => {
    const buffer = Buffer.from("col1,col2\nval1,val2");
    expect(validateFileMagicBytes(buffer, "data.csv")).toBeNull();
  });

  it("returns null for text-based formats without magic bytes (JSON)", () => {
    const buffer = Buffer.from('{"key":"value"}');
    expect(validateFileMagicBytes(buffer, "data.json")).toBeNull();
  });

  it("returns null for text-based formats without magic bytes (TXT)", () => {
    const buffer = Buffer.from("Hello, world!");
    expect(validateFileMagicBytes(buffer, "readme.txt")).toBeNull();
  });

  it("returns null for text-based formats without magic bytes (Markdown)", () => {
    const buffer = Buffer.from("# Title\nContent");
    expect(validateFileMagicBytes(buffer, "readme.md")).toBeNull();
  });

  it("returns error for a ZIP file disguised as MP3", () => {
    const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // ZIP bytes
    const result = validateFileMagicBytes(buffer, "malicious.mp3");
    expect(result).toContain("magic byte mismatch");
    expect(result).toContain(".mp3");
  });
});

// ---------------------------------------------------------------------------
// getUserStorageUsageBytes
// ---------------------------------------------------------------------------

describe("getUserStorageUsageBytes", () => {
  it("sums file sizes for all user products", async () => {
    const { prisma } = await import("../prisma");
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      { filePath: "/uploads/files/a.pdf" } as never,
      { filePath: "/uploads/files/b.zip" } as never,
    ]);

    // statSync mock returns { size: 1024 * 1024 } = 1 MB per file
    const result = await getUserStorageUsageBytes("user-1");
    expect(result).toBe(2 * 1024 * 1024); // 2 files × 1 MB
  });

  it("returns 0 when the user has no products", async () => {
    const { prisma } = await import("../prisma");
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([]);

    const result = await getUserStorageUsageBytes("user-empty");
    expect(result).toBe(0);
  });

  it("skips files where statSync throws (missing from disk)", async () => {
    const { statSync } = await import("node:fs");
    const { prisma } = await import("../prisma");

    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      { filePath: "/uploads/files/missing.pdf" } as never,
    ]);
    vi.mocked(statSync).mockImplementationOnce(() => {
      throw new Error("ENOENT");
    });

    const result = await getUserStorageUsageBytes("user-2");
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// checkStorageQuota
// ---------------------------------------------------------------------------

describe("checkStorageQuota", () => {
  it("returns null when usage is within quota", async () => {
    const { prisma } = await import("../prisma");
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([]); // 0 bytes used

    const result = await checkStorageQuota("user-ok", 100, DEFAULT_STORAGE_QUOTA_BYTES);
    expect(result).toBeNull();
  });

  it("returns an error message when quota is exceeded", async () => {
    const { prisma } = await import("../prisma");
    // 1 file of 900 MB already stored
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      { filePath: "/uploads/files/big.zip" } as never,
    ]);
    const { statSync } = await import("node:fs");
    vi.mocked(statSync).mockReturnValueOnce({ size: 900 * 1024 * 1024 } as never);

    // Uploading another 200 MB would exceed the 1 GB default quota
    const result = await checkStorageQuota(
      "user-big",
      200 * 1024 * 1024,
      DEFAULT_STORAGE_QUOTA_BYTES,
    );
    expect(result).toContain("Storage quota exceeded");
    expect(result).toContain("MB");
  });

  it("accepts a custom quota limit", async () => {
    const { prisma } = await import("../prisma");
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([]);

    // Custom quota of 10 bytes; uploading 11 bytes should fail
    const result = await checkStorageQuota("user-tiny", 11, 10);
    expect(result).toContain("Storage quota exceeded");
  });

  it("allows upload when existing file size is subtracted (replacement scenario)", async () => {
    const { prisma } = await import("../prisma");
    // 900 MB already stored
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      { filePath: "/uploads/files/big.zip" } as never,
    ]);
    const { statSync } = await import("node:fs");
    vi.mocked(statSync).mockReturnValueOnce({ size: 900 * 1024 * 1024 } as never);

    // Replacing the 900 MB file with a 950 MB file should be within the 1 GB quota
    // because effective usage = 900 MB - 900 MB + 950 MB = 950 MB < 1024 MB
    const result = await checkStorageQuota(
      "user-replace",
      950 * 1024 * 1024,
      DEFAULT_STORAGE_QUOTA_BYTES,
      900 * 1024 * 1024, // existing file being replaced
    );
    expect(result).toBeNull();
  });
});
