import { Router } from "express";
import type { TransactionController } from "./transaction.controller.ts";

/** Daftar endpoint transaksi. Router ini dipasang di `${API_PREFIX}/transactions` oleh app.ts. */
export function createTransactionRouter(controller: TransactionController): Router {
  const router = Router();
  router.get("/:id", controller.get);
  router.get("/", controller.list);
  router.post("/", controller.create);
  // Aksi massal dari bar aksi tabel Transaksi (API-CONTRACT.md bagian 4.11).
  router.post("/bulk-delete", controller.bulkDelete);
  router.post("/bulk-update", controller.bulkUpdate);
  router.patch("/:id", controller.update);
  router.delete("/:id", controller.remove);
  return router;
}

/** Endpoint ringkasan. Router ini dipasang di `${API_PREFIX}/summary` oleh app.ts. */
export function createSummaryRouter(controller: TransactionController): Router {
  const router = Router();
  router.get("/", controller.summary);
  return router;
}
