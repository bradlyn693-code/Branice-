import { createServer } from "node:http";
import { createApp } from "./app";
import { describe, expect, it } from "vitest";

describe("configured Branice app title", () => {
  it("serves the lightweight API app with the configured title", async () => {
    const server = createServer(await createApp());
    await new Promise<void>(resolve => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not start");

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/trpc/credentials.me?input=%7B%22json%22%3Anull%7D`);
      expect(process.env.VITE_APP_TITLE).toBe("Branice");
      expect(response.ok).toBe(true);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});

