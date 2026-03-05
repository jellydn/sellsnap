import { writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { saveFile, saveImage, validateImageFile } from "../upload";

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

async function* mockFileStream(data: string): AsyncGenerator<Buffer> {
  yield Buffer.from(data);
}

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
});

describe("saveImage", () => {
  it("writes file and returns URL path starting with /uploads/images/", async () => {
    const stream = mockFileStream("image-data");
    const result = await saveImage(stream, "photo.jpg");

    expect(result).toBe("/uploads/images/test-uuid.jpg");
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("test-uuid.jpg"),
      Buffer.from("image-data"),
    );
  });
});

describe("saveFile", () => {
  it("writes file and returns absolute file path", async () => {
    const stream = mockFileStream("file-data");
    const result = await saveFile(stream, "document.pdf");

    expect(result).toContain("test-uuid.pdf");
    expect(result).toContain("files");
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("test-uuid.pdf"),
      Buffer.from("file-data"),
    );
  });
});
