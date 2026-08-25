import { io, type Socket } from "socket.io-client";

export function createGameSocket(): Socket {
  return io({
    autoConnect: false,
    path: "/api/socket.io",
    transports: ["websocket", "polling"],
  });
}

export function createPlayerToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `branice-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}
