import { Router } from "express";
import type { CategoryController } from "./category.controller.ts";

/** Endpoint kategori. Router ini dipasang di `${API_PREFIX}/categories` oleh app.ts. */
export function createCategoryRouter(controller: CategoryController): Router {
  const router = Router();
  router.get("/", controller.list);
  router.post("/", controller.create);
  return router;
}
