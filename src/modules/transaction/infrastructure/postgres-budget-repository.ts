import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "../../../shared/database/database.ts";
import { toPage, type PageRequest } from "../../../shared/domain/pagination.ts";
import type { Budget } from "../domain/budget.ts";
import type { BudgetCursor, BudgetPage, BudgetRepository } from "../domain/budget-repository.ts";
import { budgets, categories } from "./transaction.table.ts";

/** Kolom satu Budget: nama kategori diambil lewat JOIN ke tabel categories. */
const budgetColumns = {
  userId: budgets.userId,
  categoryId: budgets.categoryId,
  category: categories.name,
  amount: budgets.amount,
  createdAt: budgets.createdAt,
};

/** Anggaran di Postgres. Setiap query memakai `user_id = <userId>`, jadi anggaran user lain tidak terbaca. */
export class PostgresBudgetRepository implements BudgetRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  async list(userId: string, page: PageRequest<BudgetCursor>): Promise<BudgetPage> {
    const { after } = page;
    const rows = await this.#db
      .select(budgetColumns)
      .from(budgets)
      .innerJoin(categories, eq(categories.id, budgets.categoryId))
      .where(
        and(
          eq(budgets.userId, userId),
          after
            ? sql`(${budgets.createdAt}, ${budgets.categoryId}) > (${after.createdAt.toISOString()}::timestamptz, ${after.categoryId})`
            : undefined,
        ),
      )
      .orderBy(asc(budgets.createdAt), asc(budgets.categoryId))
      .limit(page.limit + 1);
    return toPage(rows, page.limit, (budget) => ({ createdAt: budget.createdAt, categoryId: budget.categoryId }));
  }

  async upsert(userId: string, categoryId: string, amount: number): Promise<Budget> {
    // INSERT ... ON CONFLICT (user_id, category_id) DO UPDATE: satu query untuk "buat atau ganti".
    // Konflik dideteksi oleh primary key, jadi dua request bersamaan tetap menghasilkan satu baris.
    await this.#db
      .insert(budgets)
      .values({ userId, categoryId, amount })
      .onConflictDoUpdate({ target: [budgets.userId, budgets.categoryId], set: { amount } });

    const [row] = await this.#db
      .select(budgetColumns)
      .from(budgets)
      .innerJoin(categories, eq(categories.id, budgets.categoryId))
      .where(and(eq(budgets.userId, userId), eq(budgets.categoryId, categoryId)));
    if (!row) throw new Error("Upsert anggaran tidak menghasilkan baris");
    return row;
  }

  async delete(userId: string, categoryId: string): Promise<boolean> {
    const deleted = await this.#db
      .delete(budgets)
      .where(and(eq(budgets.userId, userId), eq(budgets.categoryId, categoryId)))
      .returning({ categoryId: budgets.categoryId });
    return deleted.length > 0;
  }
}
