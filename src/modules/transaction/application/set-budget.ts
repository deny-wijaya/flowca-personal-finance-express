import { assertBudgetableCategory, assertValidBudgetAmount, type Budget } from "../domain/budget.ts";
import type { BudgetRepository } from "../domain/budget-repository.ts";
import type { CategoryRepository } from "../domain/category-repository.ts";

/** Use case: membuat atau mengubah anggaran satu kategori dari menu Anggaran (PUT /budgets/:category_id). */
export class SetBudget {
  readonly #budgets: BudgetRepository;
  readonly #categories: CategoryRepository;

  constructor(budgets: BudgetRepository, categories: CategoryRepository) {
    this.#budgets = budgets;
    this.#categories = categories;
  }

  async execute(userId: string, categoryId: string, amount: number): Promise<Budget> {
    assertValidBudgetAmount(amount);
    // Kategori harus bawaan atau milik user ini, dan harus kategori pengeluaran.
    assertBudgetableCategory(await this.#categories.findById(userId, categoryId));
    return this.#budgets.upsert(userId, categoryId, amount);
  }
}
