import { io } from "socket.io-client";

const endpoint = "http://localhost:3000";

function connect(label) {
  return new Promise((resolve, reject) => {
    const socket = io(endpoint, { path: "/api/socket.io", transports: ["websocket"] });
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`${label} did not connect in time`));
    }, 5000);
    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once("connect_error", error => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function emit(socket, event, payload) {
  return new Promise(resolve => socket.emit(event, payload, resolve));
}

const suffix = `${Date.now()}${Math.random()}`.replace(/\D/g, "").slice(-16);
const host = await connect("host");
const created = await emit(host, "room:create", { boardSize: 8, playerToken: `host-${suffix}` });
if (!created.ok || !created.room?.code || created.role !== "violet") {
  throw new Error(`Room creation failed: ${JSON.stringify(created)}`);
}

const opponent = await connect("opponent");
const joined = await emit(opponent, "room:join", { code: created.room.code, playerToken: `guest-${suffix}` });
if (!joined.ok || joined.role !== "ember" || !joined.room?.hasOpponent) {
  throw new Error(`Room join failed: ${JSON.stringify(joined)}`);
}

const moved = await emit(host, "room:move", {
  code: created.room.code,
  playerToken: `host-${suffix}`,
  from: { row: 5, col: 0 },
  to: { row: 4, col: 1 },
});
if (!moved.ok) throw new Error(`Host move failed: ${JSON.stringify(moved)}`);

host.disconnect();
opponent.disconnect();
console.log(`Realtime smoke test passed for room ${created.room.code}.`);
