import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let root: string;
let scanner: Server;
let verdict = "stream: OK\0";
let scanned: Buffer[] = [];
type SaveUpload = (buffer: Buffer, filename: string, userId: string) => Promise<string>;
let upload: typeof import("../upload") & { saveFile: SaveUpload; saveImage: SaveUpload };
const {
  legacyUser,
  userUpdate,
  userCount,
  productFind,
  productUpdate,
  productCreate,
  productCount,
  productDelete,
} = vi.hoisted(() => ({
  legacyUser: vi.fn(),
  userUpdate: vi.fn(),
  userCount: vi.fn(),
  productFind: vi.fn(),
  productUpdate: vi.fn(),
  productCreate: vi.fn(),
  productCount: vi.fn(),
  productDelete: vi.fn(),
}));
vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findUnique: legacyUser,
      update: userUpdate,
      count: userCount,
      findFirst: async () => null,
    },
    product: {
      findUnique: productFind,
      create: productCreate,
      update: productUpdate,
      count: productCount,
      delete: productDelete,
    },
  },
}));
vi.mock("../auth", () => ({
  auth: { api: { getSession: async () => ({ user: { id: "alice" } }) } },
  headersToHeaders: () => new Headers(),
  getSessionFromRequest: async () => ({ user: { id: "alice" } }),
}));

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "sellsnap-upload-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  const module = await import("../upload");
  upload = {
    ...module,
    saveFile: (buffer, filename, userId) =>
      module.withUpload(userId, (session) => session.saveFile(buffer, filename)),
    saveImage: (buffer, filename, userId) =>
      module.withUpload(userId, (session) => session.saveImage(buffer, filename)),
  };
  scanner = createServer((socket) => {
    let input = Buffer.alloc(0);
    socket.on("data", (data: Buffer) => {
      input = Buffer.concat([input, data]);
      if (input.length < 10) return;
      expect(input.subarray(0, 10).toString()).toBe("zINSTREAM\0");
      const chunks: Buffer[] = [];
      let offset = 10;
      while (offset + 4 <= input.length) {
        const size = input.readUInt32BE(offset);
        offset += 4;
        if (size === 0) {
          scanned.push(Buffer.concat(chunks));
          socket.end(verdict);
          return;
        }
        if (offset + size > input.length) return;
        chunks.push(input.subarray(offset, offset + size));
        offset += size;
      }
    });
  });
  await new Promise<void>((resolve) => scanner.listen(0, "127.0.0.1", resolve));
});

beforeEach(async () => {
  await rm(join(root, "uploads"), { recursive: true, force: true });
  verdict = "stream: OK\0";
  scanned = [];
  legacyUser.mockResolvedValue({ avatarUrl: null, products: [] });
  userUpdate.mockImplementation(async ({ data }: { data: object }) => ({ id: "alice", ...data }));
  productCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: "book", ...data }));
  productFind.mockResolvedValue(null);
  productUpdate.mockReset();
  productCount.mockResolvedValue(0);
  productDelete.mockResolvedValue(undefined);
  userCount.mockResolvedValue(0);
  vi.stubEnv("CLAMAV_HOST", "127.0.0.1");
  const address = scanner.address();
  if (!address || typeof address === "string") throw new Error("Missing scanner port");
  vi.stubEnv("CLAMAV_PORT", String(address.port));
  vi.stubEnv("USER_STORAGE_QUOTA_BYTES", "1048576");
  vi.stubEnv("MAX_UPLOAD_SIZE", "1048576");
});

afterAll(async () => {
  await new Promise<void>((resolve) => scanner.close(() => resolve()));
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

describe("upload validation and storage", () => {
  it("rejects missing extensions, SVGs, and executable extensions", () => {
    expect(upload.validateImageFile("image/jpeg", "photo")).not.toBeNull();
    expect(upload.validateImageFile("image/svg+xml", "photo.svg")).not.toBeNull();
    expect(upload.validateImageFile("image/jpeg", "photo.svg")).not.toBeNull();
    expect(upload.validateProductFile("file")).not.toBeNull();
    expect(upload.validateProductFile("file.exe")).not.toBeNull();
  });

  it("rejects spoofed, mismatched, empty, malformed JSON, and binary text content", async () => {
    for (const [buffer, name] of [
      [Buffer.from("<script>bad()</script>"), "fake.pdf"],
      [Buffer.from("%PDF-1.7\n"), "fake.mp3"],
      [Buffer.alloc(0), "empty.txt"],
      [Buffer.from("{broken"), "bad.json"],
      [Buffer.from([0xff, 0xfe, 0]), "binary.txt"],
    ] as const) {
      await expect(upload.saveFile(buffer, name, "alice")).rejects.toMatchObject({
        statusCode: 400,
      });
    }
    await expect(
      upload.saveImage(Buffer.from("not an image"), "fake.png", "alice"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(scanned).toHaveLength(0);
  });

  it("stores a valid product unchanged and streams all chunks to the scanner", async () => {
    const content = Buffer.from(`%PDF-1.7\n${"data".repeat(20000)}`);
    const path = await upload.saveFile(content, "book.PDF", "../alice");
    expect(await readFile(path)).toEqual(content);
    expect(scanned).toEqual([content]);
    expect(path).toMatch(/files\/[a-f0-9]{64}\/[a-f0-9-]+\.pdf$/);
  });

  it("re-encodes images, strips metadata and appended payloads, and rejects extension mismatch", async () => {
    const image = await sharp({ create: { width: 3, height: 2, channels: 3, background: "red" } })
      .png()
      .withMetadata()
      .toBuffer();
    const payload = Buffer.concat([image, Buffer.from("appended-payload")]);
    await expect(upload.saveImage(payload, "fake.jpg", "alice")).rejects.toMatchObject({
      statusCode: 400,
    });
    const url = await upload.saveImage(payload, "photo.PNG", "alice");
    const clean = await readFile(join(root, url));
    expect(clean.includes(Buffer.from("appended-payload"))).toBe(false);
    const metadata = await sharp(clean).metadata();
    expect(metadata).toMatchObject({ width: 3, height: 2, format: "png" });
    expect(metadata.exif).toBeUndefined();
    expect(scanned).toEqual([payload]);
  });

  it.each(["jpeg", "gif", "webp"] as const)("preserves decodable %s images", async (format) => {
    const image = await sharp({ create: { width: 3, height: 2, channels: 3, background: "red" } })
      .toFormat(format)
      .toBuffer();
    const url = await upload.saveImage(image, `photo.${format}`, "alice");
    const stored = await readFile(join(root, url));
    expect(await sharp(stored).metadata()).toMatchObject({ width: 3, height: 2, format });
  });

  it("applies EXIF orientation before removing image metadata", async () => {
    const image = await sharp({ create: { width: 3, height: 2, channels: 3, background: "red" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const url = await upload.saveImage(image, "portrait.jpg", "alice");
    const stored = await readFile(join(root, url));
    expect(await sharp(stored).metadata()).toMatchObject({ width: 2, height: 3 });
    expect((await sharp(stored).metadata()).exif).toBeUndefined();
  });

  it("rejects truncated images even when their magic bytes match", async () => {
    await expect(
      upload.saveImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3]), "broken.jpg", "alice"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(
      (await readdir(upload.IMAGES_DIR, { recursive: true, withFileTypes: true })).filter((entry) =>
        entry.isFile(),
      ),
    ).toHaveLength(0);
  });

  it.each([
    ["stream: Test-Malware FOUND\0", 400],
    ["stream: size limit exceeded ERROR\0", 503],
    ["", 503],
    ["stream: NOT OK\0", 503],
  ])("does not write files for scanner verdict %j", async (response, statusCode) => {
    verdict = response;
    await expect(upload.saveFile(Buffer.from("hello"), "book.txt", "alice")).rejects.toMatchObject({
      statusCode,
    });
    expect(
      (await readdir(upload.FILES_DIR, { recursive: true, withFileTypes: true })).filter((entry) =>
        entry.isFile(),
      ),
    ).toHaveLength(0);
  });

  it("fails closed when the scanner is not configured or cannot connect", async () => {
    vi.stubEnv("CLAMAV_HOST", "");
    await expect(upload.saveFile(Buffer.from("hello"), "book.txt", "alice")).rejects.toMatchObject({
      statusCode: 503,
    });
    vi.stubEnv("CLAMAV_HOST", "127.0.0.1");
    vi.stubEnv("CLAMAV_PORT", "1");
    await expect(upload.saveFile(Buffer.from("hello"), "book.txt", "alice")).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it("enforces exact per-user quota boundaries without charging another user", async () => {
    vi.stubEnv("USER_STORAGE_QUOTA_BYTES", "9");
    await upload.saveFile(Buffer.from("12345"), "one.txt", "alice");
    await upload.saveFile(Buffer.from("6789"), "two.txt", "alice");
    await expect(upload.saveFile(Buffer.from("x"), "three.txt", "alice")).rejects.toMatchObject({
      statusCode: 413,
    });
    await expect(upload.saveFile(Buffer.from("123456789"), "one.txt", "bob")).resolves.toBeTruthy();
  });

  it("counts images and product files together", async () => {
    const image = await sharp({ create: { width: 2, height: 3, channels: 3, background: "blue" } })
      .png()
      .toBuffer();
    const url = await upload.saveImage(image, "photo.png", "alice");
    const stored = await readFile(join(root, url));
    vi.stubEnv("USER_STORAGE_QUOTA_BYTES", String(stored.length + 2));
    await expect(upload.saveFile(Buffer.from("abc"), "book.txt", "alice")).rejects.toMatchObject({
      statusCode: 413,
    });
    await expect(upload.saveFile(Buffer.from("ab"), "book.txt", "alice")).resolves.toBeTruthy();
  });

  it("counts legacy flat-directory uploads once and ignores missing legacy files", async () => {
    await mkdir(upload.FILES_DIR, { recursive: true });
    await writeFile(join(upload.FILES_DIR, "old.txt"), "12345");
    legacyUser.mockResolvedValue({
      avatarUrl: null,
      products: [
        { filePath: join(upload.FILES_DIR, "old.txt"), coverImageUrl: null },
        {
          filePath: join(upload.FILES_DIR, "old.txt"),
          coverImageUrl: "/uploads/images/missing.png",
        },
      ],
    });
    vi.stubEnv("USER_STORAGE_QUOTA_BYTES", "7");
    await expect(upload.saveFile(Buffer.from("abc"), "book.txt", "alice")).rejects.toMatchObject({
      statusCode: 413,
    });
    await expect(upload.saveFile(Buffer.from("ab"), "book.txt", "alice")).resolves.toBeTruthy();
  });

  it("does not let concurrent uploads exceed a user's quota", async () => {
    vi.stubEnv("USER_STORAGE_QUOTA_BYTES", "5");
    const results = await Promise.allSettled([
      upload.saveFile(Buffer.from("12345"), "one.txt", "alice"),
      upload.saveFile(Buffer.from("67890"), "two.txt", "alice"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const failure = results.find((result) => result.status === "rejected");
    expect([413, 429]).toContain(failure?.reason.statusCode);
  });

  it("enforces byte limits and fails closed on invalid quota configuration", async () => {
    vi.stubEnv("MAX_UPLOAD_SIZE", "4");
    await expect(upload.saveFile(Buffer.from("12345"), "book.txt", "alice")).rejects.toMatchObject({
      statusCode: 413,
    });
    vi.stubEnv("USER_STORAGE_QUOTA_BYTES", "NaN");
    await expect(upload.saveFile(Buffer.from("1234"), "book.txt", "alice")).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it("rejects over-quota requests before opening any scanner connections", async () => {
    vi.stubEnv("USER_STORAGE_QUOTA_BYTES", "1");
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        upload.saveFile(Buffer.from("too large"), "book.txt", "alice"),
      ),
    );
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(
      results.some((result) => result.status === "rejected" && result.reason.statusCode === 413),
    ).toBe(true);
    expect(scanned).toHaveLength(0);
  });

  it("admits one request per user and two globally, then releases capacity after failures", async () => {
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered!: () => void;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let count = 0;
    const hold = () => {
      if (++count === 2) entered();
      return barrier;
    };
    const first = upload.withUpload("alice", hold);
    const second = upload.withUpload("bob", hold);
    try {
      await ready;
      await expect(
        upload.withUpload("alice", async () => "incorrectly admitted"),
      ).rejects.toMatchObject({ statusCode: 429 });
      await expect(
        upload.withUpload("charlie", async () => "incorrectly admitted"),
      ).rejects.toMatchObject({ statusCode: 429 });
    } finally {
      release();
      await Promise.all([first, second]);
    }
    await expect(
      upload.withUpload("alice", async () => {
        throw new Error("failed request");
      }),
    ).rejects.toThrow("failed request");
    await expect(upload.withUpload("alice", async () => "accepted")).resolves.toBe("accepted");
  });

  it("removes new files when a later file fails validation", async () => {
    await expect(
      upload.withUpload("alice", async (session) => {
        await session.saveFile(Buffer.from("valid text"), "one.txt");
        await session.saveFile(Buffer.from("not PDF"), "two.pdf");
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(
      (await readdir(upload.FILES_DIR, { recursive: true, withFileTypes: true })).filter((entry) =>
        entry.isFile(),
      ),
    ).toHaveLength(0);
  });

  it("preserves a new file if a failed database operation actually committed its reference", async () => {
    const oldPath = await upload.saveFile(Buffer.from("old data"), "old.txt", "alice");
    legacyUser.mockResolvedValue({
      avatarUrl: null,
      products: [{ filePath: oldPath, coverImageUrl: null }],
    });
    let path = "";
    productCount.mockImplementation(async ({ where }) =>
      Number(where.OR.some((reference: { filePath?: string }) => reference.filePath === path)),
    );
    await expect(
      upload.withUpload("alice", async (session) => {
        path = await session.saveFile(Buffer.from("committed data"), "one.txt", oldPath);
        throw new Error("database response lost");
      }),
    ).rejects.toThrow("database response lost");
    expect(await readFile(path, "utf8")).toBe("committed data");
    await expect(readFile(oldPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("excludes another process for the same user and recovers when that process is killed", async () => {
    const worker = spawn(
      process.execPath,
      [
        "--import",
        createRequire(import.meta.url).resolve("tsx/esm"),
        "--input-type=module",
        "-e",
        `process.chdir(${JSON.stringify(root)});
       const { prisma } = await import(${JSON.stringify(new URL("../prisma.ts", import.meta.url).href)});
       prisma.user.findUnique = async () => ({ avatarUrl: null, products: [] });
       const { withUpload } = await import(${JSON.stringify(new URL("../upload.ts", import.meta.url).href)});
       await withUpload("alice", async () => {
         process.stdout.write("locked");
         await new Promise(() => {});
       });`,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const closed = new Promise<void>((resolve) => worker.once("close", () => resolve()));
    try {
      await new Promise<void>((resolve, reject) => {
        worker.stdout.once("data", () => resolve());
        worker.once("error", reject);
        worker.once("close", () => reject(new Error("Lock worker exited before admission")));
      });
      await expect(
        upload.withUpload("alice", async () => "incorrectly admitted"),
      ).rejects.toMatchObject({ statusCode: 429 });
    } finally {
      worker.kill("SIGKILL");
      await closed;
    }
    // The holder exits on pipe EOF after its parent dies. Do not delete its lock file.
    await expect
      .poll(async () => {
        try {
          return await upload.withUpload("alice", async () => "accepted");
        } catch (error) {
          return (error as { statusCode: number }).statusCode;
        }
      })
      .toBe("accepted");
    expect(await readdir(join(root, "uploads", "locks"))).toHaveLength(1);
  });
});

describe("upload HTTP routes with real validation and storage", () => {
  it("finishes fragmented requests with an oversized multipart boundary without stalling", async () => {
    const worker = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        String.raw`import Fastify from ${JSON.stringify(createRequire(import.meta.url).resolve("fastify"))};
         import multipart from ${JSON.stringify(createRequire(import.meta.url).resolve("@fastify/multipart"))};
         import { Readable } from "node:stream";
         const app = Fastify();
         await app.register(multipart);
         app.post("/", async request => {
           for await (const part of request.parts({ limits: { files: 2, fields: 10, parts: 12 } })) {
             if (part.type === "file") await part.toBuffer();
           }
           return { ok: true };
         });
         const boundary = "a".repeat(252);
         const payload = Readable.from([
           "--" + boundary + '\r\nContent-Disposition: form-data; name="productFile"; filename="x.txt"\r\n\r\nhello\r',
           "z".repeat(1000),
           "\r\n--" + boundary + "--\r\n",
         ]);
         const response = await app.inject({ method: "POST", url: "/",
           headers: { "content-type": "multipart/form-data; boundary=" + boundary }, payload });
         if (response.statusCode !== 200) throw new Error(response.body);
         await app.close();`,
      ],
      { stdio: ["ignore", "pipe", "pipe"], timeout: 3000 },
    );
    let errors = "";
    worker.stderr.on("data", (chunk) => {
      errors += chunk;
    });
    const code = await new Promise<number | null>((resolve, reject) => {
      worker.once("error", reject);
      worker.once("close", resolve);
    });
    expect({ code, errors }).toEqual({ code: 0, errors: "" });
  });

  it("rejects a busy user's request before parsing its multipart body", async () => {
    let release!: () => void;
    let entered!: () => void;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = upload.withUpload("alice", async () => {
      entered();
      await barrier;
    });
    const app = Fastify();
    await app.register(multipart);
    const { profileRoutes } = await import("../../routes/profile");
    await app.register(profileRoutes);
    try {
      await ready;
      const response = await app.inject({
        method: "PUT",
        url: "/api/profile",
        headers: { "content-type": "multipart/form-data; boundary=test" },
        payload: "not a multipart body",
      });
      expect(response.statusCode).toBe(429);
    } finally {
      release();
      await held;
      await app.close();
    }
  });

  it("replaces product files at full quota, removes old files, and rolls back failed updates", async () => {
    const oldPath = await upload.saveFile(Buffer.from("old!"), "old.txt", "alice");
    const product = {
      id: "book",
      creatorId: "alice",
      title: "Book",
      slug: "book",
      filePath: oldPath,
      coverImageUrl: null,
    };
    legacyUser.mockImplementation(async () => ({ avatarUrl: null, products: [product] }));
    productFind.mockImplementation(async ({ where }) => (where.id === "book" ? product : null));
    productUpdate.mockImplementation(async ({ data }) => Object.assign(product, data));
    productCount.mockImplementation(async ({ where }) =>
      Number(
        where.OR.some(
          (reference: { filePath?: string }) => reference.filePath === product.filePath,
        ),
      ),
    );
    vi.stubEnv("USER_STORAGE_QUOTA_BYTES", "4");
    const app = Fastify();
    await app.register(multipart);
    const { productRoutes } = await import("../../routes/products");
    await app.register(productRoutes);
    const request = (text: string) =>
      app.inject({
        method: "PUT",
        url: "/api/products/book",
        headers: { "content-type": "multipart/form-data; boundary=test" },
        payload: `--test\r\nContent-Disposition: form-data; name="productFile"; filename="book.txt"\r\nContent-Type: text/plain\r\n\r\n${text}\r\n--test--\r\n`,
      });
    try {
      expect((await request("new!")).statusCode).toBe(200);
      await expect(readFile(oldPath)).rejects.toMatchObject({ code: "ENOENT" });
      expect(await readFile(product.filePath, "utf8")).toBe("new!");
      const retainedPath = product.filePath;
      productUpdate.mockRejectedValueOnce(new Error("database update failed"));
      expect((await request("bad!")).statusCode).toBe(500);
      expect(await readFile(retainedPath, "utf8")).toBe("new!");
      expect(
        (await readdir(upload.FILES_DIR, { recursive: true, withFileTypes: true })).filter(
          (entry) => entry.isFile(),
        ),
      ).toHaveLength(1);
      // Failure must release both quota and admission, not block the next replacement.
      expect((await request("next")).statusCode).toBe(200);
      await expect(readFile(retainedPath)).rejects.toMatchObject({ code: "ENOENT" });
      expect(await readFile(product.filePath, "utf8")).toBe("next");
      productDelete.mockRejectedValueOnce(new Error("database delete failed"));
      expect((await app.inject({ method: "DELETE", url: "/api/products/book" })).statusCode).toBe(
        500,
      );
      expect(await readFile(product.filePath, "utf8")).toBe("next");
      productCount.mockResolvedValue(0);
      productDelete.mockRejectedValueOnce(new Error("database delete committed but response lost"));
      expect((await app.inject({ method: "DELETE", url: "/api/products/book" })).statusCode).toBe(
        500,
      );
      await expect
        .poll(async () => {
          try {
            await readFile(product.filePath);
            return "exists";
          } catch (error) {
            return (error as NodeJS.ErrnoException).code;
          }
        })
        .toBe("ENOENT");
      expect((await app.inject({ method: "DELETE", url: "/api/products/book" })).statusCode).toBe(
        204,
      );
    } finally {
      await app.close();
    }
  });

  it("replaces avatars without accumulating files and preserves the current avatar on database failure", async () => {
    const image = await sharp({ create: { width: 3, height: 2, channels: 3, background: "red" } })
      .png()
      .toBuffer();
    const oldUrl = await upload.saveImage(image, "avatar.png", "alice");
    const profile = { avatarUrl: oldUrl, products: [] };
    legacyUser.mockImplementation(async () => profile);
    userUpdate.mockImplementation(async ({ data }) => Object.assign(profile, data));
    userCount.mockImplementation(async ({ where }) =>
      Number(where.avatarUrl === profile.avatarUrl),
    );
    const oldPath = join(root, oldUrl);
    vi.stubEnv("USER_STORAGE_QUOTA_BYTES", String((await readFile(oldPath)).length));
    const app = Fastify();
    await app.register(multipart);
    const { profileRoutes } = await import("../../routes/profile");
    await app.register(profileRoutes);
    const request = () =>
      app.inject({
        method: "PUT",
        url: "/api/profile",
        headers: { "content-type": "multipart/form-data; boundary=test" },
        payload: Buffer.concat([
          Buffer.from(
            '--test\r\nContent-Disposition: form-data; name="avatar"; filename="avatar.png"\r\nContent-Type: image/png\r\n\r\n',
          ),
          image,
          Buffer.from("\r\n--test--\r\n"),
        ]),
      });
    try {
      expect((await request()).statusCode).toBe(200);
      await expect(readFile(oldPath)).rejects.toMatchObject({ code: "ENOENT" });
      const retainedUrl = profile.avatarUrl;
      userUpdate.mockRejectedValueOnce(new Error("database update failed"));
      expect((await request()).statusCode).toBe(500);
      expect(await readFile(join(root, retainedUrl))).toEqual(image);
      expect(
        (await readdir(upload.IMAGES_DIR, { recursive: true, withFileTypes: true })).filter(
          (entry) => entry.isFile(),
        ),
      ).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("does not grant replacement credit or delete an asset still referenced elsewhere", async () => {
    const path = await upload.saveFile(Buffer.from("old!"), "shared.txt", "alice");
    legacyUser.mockResolvedValue({
      avatarUrl: null,
      products: [
        { filePath: path, coverImageUrl: null },
        { filePath: path, coverImageUrl: null },
      ],
    });
    vi.stubEnv("USER_STORAGE_QUOTA_BYTES", "4");
    scanned = [];
    await expect(
      upload.withUpload("alice", (session) =>
        session.saveFile(Buffer.from("new!"), "new.txt", path),
      ),
    ).rejects.toMatchObject({ statusCode: 413 });
    expect(scanned).toHaveLength(0);
    vi.stubEnv("USER_STORAGE_QUOTA_BYTES", "8");
    productCount.mockResolvedValue(1);
    const replacement = await upload.withUpload("alice", (session) =>
      session.saveFile(Buffer.from("new!"), "new.txt", path),
    );
    expect(await readFile(path, "utf8")).toBe("old!");
    expect(await readFile(replacement, "utf8")).toBe("new!");
  });

  it("consumes an avatar before later fields, rejects oversized uploads, and rate limits requests", async () => {
    const app = Fastify();
    await app.register(rateLimit);
    await app.register(multipart, { limits: { fileSize: 1024 } });
    const { profileRoutes } = await import("../../routes/profile");
    await app.register(profileRoutes);
    try {
      const image = await sharp({ create: { width: 3, height: 2, channels: 3, background: "red" } })
        .png()
        .toBuffer();
      const body = (content: Buffer) =>
        Buffer.concat([
          Buffer.from(
            '--test\r\nContent-Disposition: form-data; name="avatar"; filename="avatar.png"\r\nContent-Type: image/png\r\n\r\n',
          ),
          content,
          Buffer.from(
            '\r\n--test\r\nContent-Disposition: form-data; name="name"\r\n\r\nAlice\r\n--test--\r\n',
          ),
        ]);
      const request = {
        method: "PUT" as const,
        url: "/api/profile",
        headers: { "content-type": "multipart/form-data; boundary=test" },
      };
      const accepted = await app.inject({ ...request, payload: body(image) });
      expect(accepted.statusCode).toBe(200);
      expect(accepted.json()).toMatchObject({
        name: "Alice",
        avatarUrl: expect.stringMatching(/\.png$/),
      });
      const stored = await readFile(join(root, accepted.json().avatarUrl));
      expect(await sharp(stored).metadata()).toMatchObject({ width: 3, height: 2 });
      expect((await app.inject({ ...request, payload: body(Buffer.alloc(1025)) })).statusCode).toBe(
        413,
      );
      for (let i = 0; i < 8; i++) {
        const response = await app.inject({ ...request, payload: body(Buffer.from("fake")) });
        expect(response.statusCode).toBe(400);
      }
      expect((await app.inject({ ...request, payload: body(image) })).statusCode).toBe(429);
    } finally {
      await app.close();
    }
  });

  it("accepts clean products, rejects disguised content and malware, and fails closed on scanner outage", async () => {
    const app = Fastify();
    await app.register(multipart, { limits: { fileSize: 1024 } });
    const { productRoutes } = await import("../../routes/products");
    await app.register(productRoutes);
    try {
      const request = (content: string) =>
        app.inject({
          method: "POST",
          url: "/api/products",
          headers: { "content-type": "multipart/form-data; boundary=test" },
          payload: `--test\r\nContent-Disposition: form-data; name="title"\r\n\r\nBook\r\n--test\r\nContent-Disposition: form-data; name="price"\r\n\r\n5\r\n--test\r\nContent-Disposition: form-data; name="productFile"; filename="book.pdf"\r\nContent-Type: application/pdf\r\n\r\n${content}\r\n--test--\r\n`,
        });
      expect((await request("%PDF-1.7\nclean")).statusCode).toBe(200);
      expect((await request("not a PDF")).statusCode).toBe(400);
      expect((await request("x".repeat(1025))).statusCode).toBe(413);
      verdict = "stream: Test-Malware FOUND\0";
      expect((await request("%PDF-1.7\nmalware")).statusCode).toBe(400);
      vi.stubEnv("CLAMAV_HOST", "");
      expect((await request("%PDF-1.7\nclean")).statusCode).toBe(503);
      vi.stubEnv("CLAMAV_HOST", "127.0.0.1");
      verdict = "stream: OK\0";
      productCreate.mockRejectedValueOnce(new Error("database create failed"));
      expect((await request("%PDF-1.7\nclean")).statusCode).toBe(500);
      expect(
        (await readdir(upload.FILES_DIR, { recursive: true, withFileTypes: true })).filter(
          (entry) => entry.isFile(),
        ),
      ).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});
