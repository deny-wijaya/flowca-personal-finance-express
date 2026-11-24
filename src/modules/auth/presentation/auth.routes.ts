import { Router, type RequestHandler } from "express";
import type { AuthController } from "./auth.controller.ts";

/** Middleware yang dipasang app.ts di route tertentu. */
export type AuthRouteGuards = {
  requireAuth: RequestHandler;
  /** Membatasi login gagal per IP (PRD C5). */
  loginLimit: RequestHandler;
};

/**
 * Daftar endpoint auth. Router ini dipasang di `${API_PREFIX}/auth` oleh app.ts.
 * Register dan login terbuka (user belum punya token); `/me` wajib login.
 */
export function createAuthRouter(controller: AuthController, { requireAuth, loginLimit }: AuthRouteGuards): Router {
  const router = Router();
  router.post("/register", controller.register);
  router.post("/login", loginLimit, controller.login);
  router.get("/me", requireAuth, controller.me);
  router.patch("/me", requireAuth, controller.updateMe);
  return router;
}
