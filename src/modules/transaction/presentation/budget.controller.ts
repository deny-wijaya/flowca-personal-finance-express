import type { RequestHandler } from "express";
import { toPageDto } from "../../../shared/http/pagination.ts";
import { authOf } from "../../../shared/http/middlewares/require-auth.ts";
import { parseRequest } from "../../../shared/http/validate.ts";
import type { DeleteBudget } from "../application/delete-budget.ts";
import type { ListBudgets } from "../application/list-budgets.ts";
import type { SetBudget } from "../application/set-budget.ts";
import { budgetParamsSchema, encodeBudgetCursor, listBudgetsQuerySchema, setBudgetBodySchema, toBudgetDto } from "./budget.schemas.ts";

export type BudgetUseCases = {
  listBudgets: ListBudgets;
  setBudget: SetBudget;
  deleteBudget: DeleteBudget;
};

/** Controller /budgets. Router-nya dipasangi requireAuth, jadi `authOf(req).userId` selalu terisi. */
export function createBudgetController(useCases: BudgetUseCases) {
  const list: RequestHandler = async (req, res) => {
    const { limit, cursor } = parseRequest(listBudgetsQuerySchema, req.query);
    const page = await useCases.listBudgets.execute(authOf(req).userId, { limit, after: cursor });
    const nextCursor = page.nextCursor ? encodeBudgetCursor(page.nextCursor) : null;
    res.json({ data: page.items.map(toBudgetDto), page: toPageDto(limit, nextCursor) });
  };

  const set: RequestHandler = async (req, res) => {
    const { category_id } = parseRequest(budgetParamsSchema, req.params);
    const { amount } = parseRequest(setBudgetBodySchema, req.body);
    const budget = await useCases.setBudget.execute(authOf(req).userId, category_id, amount);
    res.json({ data: toBudgetDto(budget) });
  };

  const remove: RequestHandler = async (req, res) => {
    const { category_id } = parseRequest(budgetParamsSchema, req.params);
    await useCases.deleteBudget.execute(authOf(req).userId, category_id);
    res.status(204).end();
  };

  return { list, set, remove };
}

export type BudgetController = ReturnType<typeof createBudgetController>;
