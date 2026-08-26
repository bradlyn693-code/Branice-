import { describe, expect, it } from "vitest";
import { hashPassword, normalizeEmail, verifyPassword } from "./credentialAuth";

describe("credential authentication", () => {
  it("normalizes email addresses consistently", () => {
    expect(normalizeEmail("  Player@Example.COM ")).toBe("player@example.com");
  });

  it("hashes passwords without retaining their plain text and verifies only the correct value", async () => {
    const passwordHash = await hashPassword("correct-horse-battery-staple");
    expect(passwordHash).not.toContain("correct-horse-battery-staple");
    await expect(verifyPassword("correct-horse-battery-staple", passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("incorrect-password", passwordHash)).resolves.toBe(false);
  });
});
