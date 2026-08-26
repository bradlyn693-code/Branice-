import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { credentialProcedure, publicProcedure, router } from "./_core/trpc";
import { CREDENTIAL_COOKIE, CREDENTIAL_SESSION_SECONDS, createCredentialSession, hashPassword, normalizeEmail, verifyPassword } from "./credentialAuth";
import { claimGameRoomOpponent, createGameRoom, createPlayerAccount, getGameRoom, getPlayerAccountByEmail, updateGameRoomState } from "./db";
import { resolvePlayerRole } from "./gameRooms";
import { z } from "zod";
import { customAlphabet } from "nanoid";
import { applyMove, createInitialGame, findMove, type PlayerColor } from "../shared/checkers";

const credentialsInput = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});

const roomStateInput = z.object({
  code: z.string().regex(/^[A-Z2-9]{6}$/),
  playerToken: z.string().min(12).max(64),
});

const boardSizeInput = z.union([z.literal(8), z.literal(10), z.literal(12)]);
const roomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

function playerAccountPayload(account: { id: number; email: string }) {
  return { id: account.id, email: account.email };
}

function roomStatePayload(room: NonNullable<Awaited<ReturnType<typeof getGameRoom>>>) {
  return {
    code: room.code,
    boardSize: room.boardSize as 8 | 10 | 12,
    state: JSON.parse(room.gameState),
    status: room.status as "waiting" | "active" | "complete",
    hasOpponent: Boolean(room.opponentToken),
  };
}

async function createAvailableRoomCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = roomCode();
    if (!(await getGameRoom(code))) return code;
  }
  throw new Error("We could not allocate a room code. Please try again.");
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  credentials: router({
    me: publicProcedure.query(({ ctx }) => ctx.credentialUser),
    register: publicProcedure.input(credentialsInput).mutation(async ({ input, ctx }) => {
      const email = normalizeEmail(input.email);
      if (await getPlayerAccountByEmail(email)) {
        throw new Error("An account with that email already exists. Please sign in instead.");
      }
      const account = await createPlayerAccount({ email, passwordHash: await hashPassword(input.password) });
      const token = await createCredentialSession(account);
      ctx.res.cookie(CREDENTIAL_COOKIE, token, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: CREDENTIAL_SESSION_SECONDS * 1000,
      });
      return playerAccountPayload(account);
    }),
    signIn: publicProcedure.input(credentialsInput).mutation(async ({ input, ctx }) => {
      const email = normalizeEmail(input.email);
      const account = await getPlayerAccountByEmail(email);
      if (!account || !(await verifyPassword(input.password, account.passwordHash))) {
        throw new Error("Email or password is incorrect.");
      }
      const token = await createCredentialSession(account);
      ctx.res.cookie(CREDENTIAL_COOKIE, token, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: CREDENTIAL_SESSION_SECONDS * 1000,
      });
      return playerAccountPayload(account);
    }),
    signOut: credentialProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(CREDENTIAL_COOKIE, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  rooms: router({
    create: credentialProcedure
      .input(z.object({ boardSize: boardSizeInput, playerToken: z.string().min(12).max(64) }))
      .mutation(async ({ input }) => {
        const code = await createAvailableRoomCode();
        const room = await createGameRoom({
          code,
          boardSize: input.boardSize,
          hostToken: input.playerToken,
          gameState: JSON.stringify(createInitialGame(input.boardSize)),
        });
        return { role: "violet" as const, room: roomStatePayload(room) };
      }),
    join: credentialProcedure.input(roomStateInput).mutation(async ({ input }) => {
      const room = await getGameRoom(input.code);
      if (!room) throw new Error("That room code is unavailable.");
      let activeRoom = room;
      let role = resolvePlayerRole(room, input.playerToken);
      if (!role && !room.opponentToken) {
        activeRoom = await claimGameRoomOpponent(input.code, input.playerToken);
        role = "ember";
      }
      if (!role) throw new Error("This room already has two players.");
      return { role, room: roomStatePayload(activeRoom) };
    }),
    state: credentialProcedure.input(roomStateInput).query(async ({ input }) => {
      const room = await getGameRoom(input.code);
      if (!room || !resolvePlayerRole(room, input.playerToken)) {
        throw new Error("That room is unavailable for this player session.");
      }
      return roomStatePayload(room);
    }),
    move: credentialProcedure
      .input(roomStateInput.extend({ from: z.object({ row: z.number().int(), col: z.number().int() }), to: z.object({ row: z.number().int(), col: z.number().int() }) }))
      .mutation(async ({ input }) => {
        const room = await getGameRoom(input.code);
        const role = room ? resolvePlayerRole(room, input.playerToken) : null;
        if (!room || !role) throw new Error("Your room session is no longer valid.");
        const currentGame = roomStatePayload(room).state;
        if (currentGame.winner || currentGame.currentPlayer !== role) throw new Error("Wait for your turn before moving.");
        const move = findMove(currentGame, input.from, input.to);
        if (!move) throw new Error("That square is not a valid move.");
        const nextGame = applyMove(currentGame, move);
        const status = nextGame.winner ? "complete" : room.opponentToken ? "active" : "waiting";
        const nextRoom = await updateGameRoomState(input.code, nextGame, status);
        return roomStatePayload(nextRoom);
      }),
    reset: credentialProcedure.input(roomStateInput).mutation(async ({ input }) => {
      const room = await getGameRoom(input.code);
      if (!room || resolvePlayerRole(room, input.playerToken) !== "violet") {
        throw new Error("Only the host can start a rematch.");
      }
      const currentRound = roomStatePayload(room).state.round ?? 1;
      const status = room.opponentToken ? "active" : "waiting";
      const nextRoom = await updateGameRoomState(
        input.code,
        createInitialGame(room.boardSize as 8 | 10 | 12, currentRound + 1),
        status
      );
      return roomStatePayload(nextRoom);
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
