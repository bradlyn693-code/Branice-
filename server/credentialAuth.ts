import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { SignJWT, jwtVerify } from "jose";
import { parse } from "cookie";

export const CREDENTIAL_COOKIE = "branice_credentials";
export const CREDENTIAL_SESSION_SECONDS = 60 * 60 * 24 * 14;

export type CredentialIdentity = {
  id: number;
  email: string;
};

const scrypt = promisify(scryptCallback);

function signingKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required for credential sessions.");
  return new TextEncoder().encode(secret);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, saltHex, expectedHex] = passwordHash.split("$");
  if (algorithm !== "scrypt" || !saltHex || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(password, Buffer.from(saltHex, "hex"), 64)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createCredentialSession(identity: CredentialIdentity) {
  return new SignJWT({ email: identity.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(identity.id))
    .setIssuer("branice")
    .setAudience("branice-web")
    .setIssuedAt()
    .setExpirationTime(`${CREDENTIAL_SESSION_SECONDS}s`)
    .sign(signingKey());
}

export async function getCredentialUserFromRequest(req: { headers: { cookie?: string } }) {
  try {
    const token = parse(req.headers.cookie ?? "")[CREDENTIAL_COOKIE];
    if (!token) return null;
    const verified = await jwtVerify(token, signingKey(), {
      issuer: "branice",
      audience: "branice-web",
    });
    const id = Number(verified.payload.sub);
    const email = typeof verified.payload.email === "string" ? verified.payload.email : "";
    if (!Number.isInteger(id) || id <= 0 || !email) return null;
    return { id, email } satisfies CredentialIdentity;
  } catch {
    return null;
  }
}
