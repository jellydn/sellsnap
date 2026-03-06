import { describe, expect, it } from "vitest";

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const RESERVED_SLUGS = new Set([
  "api",
  "sign-in",
  "sign-up",
  "dashboard",
  "admin",
  "settings",
  "purchase",
  "creator",
  "p",
]);

function validateSlug(slug: string): string | null {
  if (!SLUG_REGEX.test(slug)) {
    return "Slug must be 3-40 characters, lowercase alphanumeric and hyphens only";
  }
  if (RESERVED_SLUGS.has(slug)) {
    return "This slug is reserved";
  }
  return null;
}

describe("slug validation (SEC-7)", () => {
  it("accepts valid slugs with lowercase alphanumeric and hyphens", () => {
    expect(validateSlug("my-valid-slug-123")).toBeNull();
    expect(validateSlug("abc")).toBeNull();
    expect(validateSlug("a-b-c")).toBeNull();
    expect(validateSlug("test123")).toBeNull();
  });

  it("rejects slugs with uppercase letters", () => {
    expect(validateSlug("Invalid-Slug")).toBe(
      "Slug must be 3-40 characters, lowercase alphanumeric and hyphens only",
    );
    expect(validateSlug("TEST")).toBe(
      "Slug must be 3-40 characters, lowercase alphanumeric and hyphens only",
    );
  });

  it("rejects slugs under 3 characters", () => {
    expect(validateSlug("ab")).toBe(
      "Slug must be 3-40 characters, lowercase alphanumeric and hyphens only",
    );
    expect(validateSlug("a")).toBe(
      "Slug must be 3-40 characters, lowercase alphanumeric and hyphens only",
    );
  });

  it("rejects slugs over 40 characters", () => {
    const longSlug = "a".repeat(41);
    expect(validateSlug(longSlug)).toBe(
      "Slug must be 3-40 characters, lowercase alphanumeric and hyphens only",
    );
  });

  it("rejects slugs starting with hyphen", () => {
    expect(validateSlug("-invalid-slug")).toBe(
      "Slug must be 3-40 characters, lowercase alphanumeric and hyphens only",
    );
  });

  it("rejects slugs ending with hyphen", () => {
    expect(validateSlug("invalid-slug-")).toBe(
      "Slug must be 3-40 characters, lowercase alphanumeric and hyphens only",
    );
  });

  it("blocks all reserved slugs that pass regex validation", () => {
    const reservedSlugs = [
      "api",
      "sign-in",
      "sign-up",
      "dashboard",
      "admin",
      "settings",
      "purchase",
      "creator",
    ];

    for (const slug of reservedSlugs) {
      expect(validateSlug(slug)).toBe("This slug is reserved");
    }
  });

  it("rejects short reserved slugs that fail regex", () => {
    expect(validateSlug("p")).toBe(
      "Slug must be 3-40 characters, lowercase alphanumeric and hyphens only",
    );
  });

  it("rejects slugs with special characters", () => {
    expect(validateSlug("invalid@slug")).toBe(
      "Slug must be 3-40 characters, lowercase alphanumeric and hyphens only",
    );
    expect(validateSlug("test.slug")).toBe(
      "Slug must be 3-40 characters, lowercase alphanumeric and hyphens only",
    );
    expect(validateSlug("test_slug")).toBe(
      "Slug must be 3-40 characters, lowercase alphanumeric and hyphens only",
    );
  });

  it("rejects slugs with spaces", () => {
    expect(validateSlug("invalid slug")).toBe(
      "Slug must be 3-40 characters, lowercase alphanumeric and hyphens only",
    );
  });

  it("accepts exactly 40 characters", () => {
    const maxSlug = "a".repeat(40);
    expect(validateSlug(maxSlug)).toBeNull();
  });

  it("accepts exactly 3 characters", () => {
    expect(validateSlug("abc")).toBeNull();
  });
});
