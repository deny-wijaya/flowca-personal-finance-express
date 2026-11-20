import { Router } from "express";
import type { TransactionController } from "./transaction.controller.ts";

/** Daftar endpoint transaksi. Router ini dipasang di `${API_PREFIX}/transactions` oleh app.ts. */
export function createTransactionRouter(controller: TransactionController): Router {
  const router = Router();
  router.get("/", controller.list);
  router.post("/", controller.create);
  router.patch("/:id", controller.update);
  router.delete("/:id", controller.remove);
  return router;
}
