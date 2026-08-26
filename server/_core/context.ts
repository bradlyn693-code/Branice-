import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getCredentialUserFromRequest, type CredentialIdentity } from "../credentialAuth";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  credentialUser: CredentialIdentity | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let credentialUser: CredentialIdentity | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  credentialUser = await getCredentialUserFromRequest(opts.req);

  return {
    req: opts.req,
    res: opts.res,
    user,
    credentialUser,
  };
}
