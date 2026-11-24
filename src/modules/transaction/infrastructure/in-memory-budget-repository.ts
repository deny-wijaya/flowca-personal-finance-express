import { toPage, type PageRequest } from "../../../shared/domain/pagination.ts";
import type { Budget } from "../domain/budget.ts";
import type { BudgetCursor, BudgetPage, BudgetRepository } from "../domain/budget-repository.ts";
import { InMemoryCategoryRepository } from "./in-memory-category-repository.ts";

/** Anggaran di memori untuk test. Kuncinya "userId:categoryId", sama dengan primary key di Postgres. */
export class InMemoryBudgetRepository implements BudgetRepository {
  readonly #rows = new Map<string, Omit<Budget, "category">>();
  readonly #categories: InMemoryCategoryRepository;

  constructor(categories: InMemoryCategoryRepository = new InMemoryCategoryRepository()) {
    this.#categories = categories;
  }

  async list(userId: string, page: PageRequest<BudgetCursor>): Promise<BudgetPage> {
    const after = page.after;
    const rows = [...this.#rows.values()]
      .filter((budget) => budget.userId === userId)
      .sort(oldestFirst)
      .filter((budget) => !after || oldestFirst(budget, after) > 0)
      .map((budget) => ({ ...budget, category: this.#categories.nameOf(budget.categoryId) }));
    return toPage(rows.slice(0, page.limit + 1), page.limit, (budget) => ({ createdAt: budget.createdAt, categoryId: budget.categoryId }));
  }

  async upsert(userId: string, categoryId: string, amount: number): Promise<Budget> {
    const key = `${userId}:${categoryId}`;
    const existing = this.#rows.get(key);
    const row = existing ? { ...existing, amount } : { userId, categoryId, amount, createdAt: new Date() };
    this.#rows.set(key, row);
    return { ...row, category: this.#categories.nameOf(categoryId) };
  }

  async delete(userId: string, categoryId: string): Promise<boolean> {
    return this.#rows.delete(`${userId}:${categoryId}`);
  }
}

function oldestFirst(a: Pick<Budget, "createdAt" | "categoryId">, b: Pick<Budget, "createdAt" | "categoryId">): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || (a.categoryId < b.categoryId ? -1 : a.categoryId > b.categoryId ? 1 : 0);
}
