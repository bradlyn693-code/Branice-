import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { gameRooms, InsertUser, playerAccounts, users } from "../drizzle/schema";
import type { GameState } from "../shared/checkers";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getGameRoom(code: string) {
  const db = await getDb();
  if (!db) throw new Error("Game room storage is unavailable.");
  const result = await db.select().from(gameRooms).where(eq(gameRooms.code, code)).limit(1);
  return result[0] ?? null;
}

export async function createGameRoom(input: {
  code: string;
  boardSize: 8 | 10 | 12;
  hostToken: string;
  gameState: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Game room storage is unavailable.");
  await db.insert(gameRooms).values({
    ...input,
    status: "waiting",
  });
  const room = await getGameRoom(input.code);
  if (!room) throw new Error("New game room could not be loaded.");
  return room;
}

export async function claimGameRoomOpponent(code: string, opponentToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Game room storage is unavailable.");
  await db
    .update(gameRooms)
    .set({ opponentToken, status: "active" })
    .where(eq(gameRooms.code, code));
  const room = await getGameRoom(code);
  if (!room) throw new Error("Joined game room could not be loaded.");
  return room;
}

export async function updateGameRoomState(
  code: string,
  state: GameState,
  status: "waiting" | "active" | "complete"
) {
  const db = await getDb();
  if (!db) throw new Error("Game room storage is unavailable.");
  await db
    .update(gameRooms)
    .set({ gameState: JSON.stringify(state), status })
    .where(eq(gameRooms.code, code));
  const room = await getGameRoom(code);
  if (!room) throw new Error("Updated game room could not be loaded.");
  return room;
}

export async function getPlayerAccountByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Account storage is unavailable.");
  const result = await db.select().from(playerAccounts).where(eq(playerAccounts.email, email)).limit(1);
  return result[0] ?? null;
}

export async function createPlayerAccount(input: { email: string; passwordHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Account storage is unavailable.");
  await db.insert(playerAccounts).values(input);
  const account = await getPlayerAccountByEmail(input.email);
  if (!account) throw new Error("New player account could not be loaded.");
  return account;
}
