import { Router } from "express";
import type { BudgetController } from "./budget.controller.ts";

/** Endpoint anggaran. Router ini dipasang di `${API_PREFIX}/budgets` oleh app.ts. */
export function createBudgetRouter(controller: BudgetController): Router {
  const router = Router();
  router.get("/", controller.list);
  router.put("/:category_id", controller.set);
  router.delete("/:category_id", controller.remove);
  return router;
}
