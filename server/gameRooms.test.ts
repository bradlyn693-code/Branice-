import { describe, expect, it } from "vitest";
import { resolvePlayerRole } from "./gameRooms";

describe("room session assignment", () => {
  const room = { hostToken: "host-session-token", opponentToken: "opponent-session-token" };

  it("returns the correct color for saved room participants", () => {
    expect(resolvePlayerRole(room, "host-session-token")).toBe("violet");
    expect(resolvePlayerRole(room, "opponent-session-token")).toBe("ember");
  });

  it("does not assign an existing two-player room to an unrelated browser", () => {
    expect(resolvePlayerRole(room, "unrelated-session-token")).toBeNull();
  });
});
