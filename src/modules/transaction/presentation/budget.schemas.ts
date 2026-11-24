import { z } from "zod";
import { cursorQuery, encodeCursor, limitQuery } from "../../../shared/http/pagination.ts";
import type { Budget } from "../domain/budget.ts";
import type { BudgetCursor } from "../domain/budget-repository.ts";

/** Schema request dan response anggaran sesuai API-CONTRACT.md bagian 4.10. */

/** Isi cursor anggaran sebelum di-encode: `c` = created_at, `k` = category_id. */
function budgetCursorShape() {
  return z
    .object({ c: z.iso.datetime(), k: z.string().min(1) })
    .transform((c): BudgetCursor => ({ createdAt: new Date(c.c), categoryId: c.k }));
}

export function encodeBudgetCursor(cursor: BudgetCursor): string {
  return encodeCursor({ c: cursor.createdAt.toISOString(), k: cursor.categoryId });
}

export const listBudgetsQuerySchema = z.object({
  limit: limitQuery,
  cursor: cursorQuery(budgetCursorShape()).optional(),
});

export const budgetParamsSchema = z.object({ category_id: z.string().min(1) });

/** Bilangan bulat dan batas nominal dicek di domain. */
export const setBudgetBodySchema = z.object({
  amount: z.number({ message: "Nominal anggaran wajib berupa angka" }),
});

export function toBudgetDto(budget: Budget) {
  return { category_id: budget.categoryId, category: budget.category, amount: budget.amount };
}
