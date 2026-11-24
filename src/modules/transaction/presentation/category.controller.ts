import type { RequestHandler } from "express";
import { toPageDto } from "../../../shared/http/pagination.ts";
import { authOf } from "../../../shared/http/middlewares/require-auth.ts";
import { parseRequest } from "../../../shared/http/validate.ts";
import type { CreateCategory } from "../application/create-category.ts";
import type { ListCategories } from "../application/list-categories.ts";
import { createCategoryBodySchema, encodeCategoryCursor, listCategoriesQuerySchema, toCategoryDto } from "./category.schemas.ts";

export type CategoryUseCases = {
  listCategories: ListCategories;
  createCategory: CreateCategory;
};

/** Controller /categories. Router-nya dipasangi requireAuth, jadi `authOf(req).userId` selalu terisi. */
export function createCategoryController(useCases: CategoryUseCases) {
  const list: RequestHandler = async (req, res) => {
    const { limit, cursor, type } = parseRequest(listCategoriesQuerySchema, req.query);
    const page = await useCases.listCategories.execute(authOf(req).userId, { type }, { limit, after: cursor });
    const nextCursor = page.nextCursor ? encodeCategoryCursor(page.nextCursor) : null;
    res.json({ data: page.items.map(toCategoryDto), page: toPageDto(limit, nextCursor) });
  };

  const create: RequestHandler = async (req, res) => {
    const body = parseRequest(createCategoryBodySchema, req.body);
    const category = await useCases.createCategory.execute(authOf(req).userId, body);
    res.status(201).json({ data: toCategoryDto(category) });
  };

  return { list, create };
}

export type CategoryController = ReturnType<typeof createCategoryController>;
