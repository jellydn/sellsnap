import { describe, expect, it, vi } from "vitest";
import { saveFile, saveImage, validateImageFile, validateProductFile } from "../upload";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  };
});

vi.mock("node:crypto", () => ({
  randomUUID: () => "test-uuid",
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
