import { Router } from "express";
import type { AuthController } from "./auth.controller.ts";

/** Daftar endpoint auth. Router ini dipasang di `${API_PREFIX}/auth` oleh app.ts. */
export function createAuthRouter(controller: AuthController): Router {
  const router = Router();
  router.post("/register", controller.register);
  return router;
}
