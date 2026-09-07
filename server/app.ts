import express from "express";
import type { Server } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { registerGameSockets } from "./gameRooms";
import { createContext } from "./_core/context";
import { serveStatic, setupVite } from "./_core/vite";

export async function createApp(options: { server?: Server; includeStatic?: boolean } = {}) {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (options.server) {
    registerGameSockets(options.server);
  }

  if (options.includeStatic) {
    if (process.env.NODE_ENV === "development" && options.server) {
      await setupVite(app, options.server);
    } else {
      serveStatic(app);
    }
  }

  return app;
}
