import type { Server as HttpServer } from "http";
import { customAlphabet } from "nanoid";
import { Server, type Socket } from "socket.io";
import {
  applyMove,
  createInitialGame,
  findMove,
  type GameState,
  type PlayerColor,
  type Position,
} from "../shared/checkers";
import type { GameRoom } from "../drizzle/schema";
import {
  claimGameRoomOpponent,
  createGameRoom,
  getGameRoom,
  updateGameRoomState,
} from "./db";

type RoomStatus = "waiting" | "active" | "complete";
type Ack = (payload: Record<string, unknown>) => void;

const createRoomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const activeSockets = new Map<string, Map<PlayerColor, Set<string>>>();

function safeAck(callback: unknown, payload: Record<string, unknown>) {
  if (typeof callback === "function") (callback as Ack)(payload);
}

function isBoardSize(value: unknown): value is 8 | 10 | 12 {
  return value === 8 || value === 10 || value === 12;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function roomSnapshot(room: GameRoom) {
  return {
    code: room.code,
    boardSize: room.boardSize as 8 | 10 | 12,
    state: JSON.parse(room.gameState) as GameState,
    status: room.status as RoomStatus,
    hasOpponent: Boolean(room.opponentToken),
  };
}

function roomPresence(code: string) {
  const players = activeSockets.get(code);
  return {
    violet: Boolean(players?.get("violet")?.size),
    ember: Boolean(players?.get("ember")?.size),
  };
}

function rememberSocket(socket: Socket, code: string, role: PlayerColor) {
  socket.join(code);
  const rooms = (socket.data.braniceRooms as Array<{ code: string; role: PlayerColor }> | undefined) ?? [];
  if (!rooms.some(room => room.code === code && room.role === role)) {
    rooms.push({ code, role });
    socket.data.braniceRooms = rooms;
  }
  const members = activeSockets.get(code) ?? new Map<PlayerColor, Set<string>>();
  const playerSockets = members.get(role) ?? new Set<string>();
  playerSockets.add(socket.id);
  members.set(role, playerSockets);
  activeSockets.set(code, members);
}

function forgetSocket(socket: Socket) {
  const rooms = (socket.data.braniceRooms as Array<{ code: string; role: PlayerColor }> | undefined) ?? [];
  for (const { code, role } of rooms) {
    const members = activeSockets.get(code);
    members?.get(role)?.delete(socket.id);
    if (members && !(members.get("violet")?.size || members.get("ember")?.size)) {
      activeSockets.delete(code);
    }
  }
}

export function resolvePlayerRole(
  room: Pick<GameRoom, "hostToken" | "opponentToken">,
  playerToken: string
): PlayerColor | null {
  if (room.hostToken === playerToken) return "violet";
  if (room.opponentToken === playerToken) return "ember";
  return null;
}

async function issueAvailableCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = createRoomCode();
    if (!(await getGameRoom(code))) return code;
  }
  throw new Error("Unable to issue an available room code.");
}

export function registerGameSockets(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    path: "/api/socket.io",
    cors: { origin: true, credentials: true },
  });

  io.on("connection", socket => {
    socket.on("room:create", async (rawPayload: unknown, callback: unknown) => {
      try {
        const payload = rawPayload as { boardSize?: unknown; playerToken?: unknown };
        const boardSize = Number(payload?.boardSize);
        const playerToken = readString(payload?.playerToken);
        if (!isBoardSize(boardSize) || playerToken.length < 12) {
          safeAck(callback, { ok: false, error: "Please select a valid board and player session." });
          return;
        }

        const code = await issueAvailableCode();
        const room = await createGameRoom({
          code,
          boardSize,
          hostToken: playerToken,
          gameState: JSON.stringify(createInitialGame(boardSize)),
        });
        rememberSocket(socket, code, "violet");
        io.to(code).emit("room:presence", roomPresence(code));
        safeAck(callback, { ok: true, role: "violet", room: roomSnapshot(room) });
      } catch (error) {
        console.error("[Branice] room creation failed", error);
        safeAck(callback, { ok: false, error: "We could not create your room. Please try again." });
      }
    });

    socket.on("room:join", async (rawPayload: unknown, callback: unknown) => {
      try {
        const payload = rawPayload as { code?: unknown; playerToken?: unknown };
        const code = readString(payload?.code).toUpperCase();
        const playerToken = readString(payload?.playerToken);
        const room = await getGameRoom(code);
        if (!room || playerToken.length < 12) {
          safeAck(callback, { ok: false, error: "That room code is unavailable." });
          return;
        }

        let activeRoom = room;
        let role = resolvePlayerRole(room, playerToken);
        if (!role && !room.opponentToken) {
          activeRoom = await claimGameRoomOpponent(code, playerToken);
          role = "ember";
        }
        if (!role) {
          safeAck(callback, { ok: false, error: "This room already has two players." });
          return;
        }

        rememberSocket(socket, code, role);
        io.to(code).emit("room:presence", roomPresence(code));
        safeAck(callback, { ok: true, role, room: roomSnapshot(activeRoom) });
      } catch (error) {
        console.error("[Branice] room join failed", error);
        safeAck(callback, { ok: false, error: "We could not join that room. Please try again." });
      }
    });

    socket.on("room:move", async (rawPayload: unknown, callback: unknown) => {
      try {
        const payload = rawPayload as {
          code?: unknown;
          playerToken?: unknown;
          from?: Position;
          to?: Position;
        };
        const code = readString(payload?.code).toUpperCase();
        const playerToken = readString(payload?.playerToken);
        const room = await getGameRoom(code);
        const role = room ? resolvePlayerRole(room, playerToken) : null;
        if (!room || !role || !payload.from || !payload.to) {
          safeAck(callback, { ok: false, error: "Your room session is no longer valid." });
          return;
        }

        const currentGame = roomSnapshot(room).state;
        if (currentGame.winner || currentGame.currentPlayer !== role) {
          safeAck(callback, { ok: false, error: "Wait for your turn before moving." });
          return;
        }
        const move = findMove(currentGame, payload.from, payload.to);
        if (!move) {
          safeAck(callback, { ok: false, error: "That square is not a valid move." });
          return;
        }

        const nextGame = applyMove(currentGame, move);
        const status: RoomStatus = nextGame.winner
          ? "complete"
          : room.opponentToken
            ? "active"
            : "waiting";
        const nextRoom = await updateGameRoomState(code, nextGame, status);
        io.to(code).emit("room:state", roomSnapshot(nextRoom));
        safeAck(callback, { ok: true });
      } catch (error) {
        console.error("[Branice] room move failed", error);
        safeAck(callback, { ok: false, error: "We could not save that move. Try again." });
      }
    });

    socket.on("room:reset", async (rawPayload: unknown, callback: unknown) => {
      try {
        const payload = rawPayload as { code?: unknown; playerToken?: unknown };
        const code = readString(payload?.code).toUpperCase();
        const room = await getGameRoom(code);
        if (!room || resolvePlayerRole(room, readString(payload?.playerToken)) !== "violet") {
          safeAck(callback, { ok: false, error: "Only the host can start a rematch." });
          return;
        }
        const status: RoomStatus = room.opponentToken ? "active" : "waiting";
        const currentRound = roomSnapshot(room).state.round ?? 1;
        const nextRoom = await updateGameRoomState(
          code,
          createInitialGame(room.boardSize as 8 | 10 | 12, currentRound + 1),
          status
        );
        io.to(code).emit("room:state", roomSnapshot(nextRoom));
        safeAck(callback, { ok: true });
      } catch (error) {
        console.error("[Branice] reset failed", error);
        safeAck(callback, { ok: false, error: "We could not start the rematch." });
      }
    });

    socket.on("disconnect", () => {
      const rooms = (socket.data.braniceRooms as Array<{ code: string }> | undefined) ?? [];
      forgetSocket(socket);
      for (const { code } of rooms) io.to(code).emit("room:presence", roomPresence(code));
    });
  });
}
