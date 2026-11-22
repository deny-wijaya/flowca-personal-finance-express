import { Router, type RequestHandler } from "express";
import type { AuthController } from "./auth.controller.ts";

/**
 * Daftar endpoint auth. Router ini dipasang di `${API_PREFIX}/auth` oleh app.ts.
 * Register dan login terbuka (user belum punya token); `/me` wajib login.
 */
export function createAuthRouter(controller: AuthController, requireAuth: RequestHandler): Router {
  const router = Router();
  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.get("/me", requireAuth, controller.me);
  return router;
}
