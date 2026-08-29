import { describe, expect, it } from "vitest";

describe("configured Branice app title", () => {
  it("matches the title served by the lightweight app endpoint", async () => {
    const response = await fetch("http://localhost:3000/");
    const html = await response.text();

    expect(process.env.VITE_APP_TITLE).toBe("Branice");
    expect(response.ok).toBe(true);
    expect(html).toContain("Branice");
  });
});

