import { Router } from "express";
import type { AccountController } from "./account.controller.ts";

/** Endpoint akun. Router ini dipasang di `${API_PREFIX}/accounts` oleh app.ts. */
export function createAccountRouter(controller: AccountController): Router {
  const router = Router();
  router.get("/", controller.list);
  router.post("/", controller.create);
  return router;
}
