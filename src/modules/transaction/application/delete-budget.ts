import { NotFoundError } from "../../../shared/domain/errors.ts";
import type { BudgetRepository } from "../domain/budget-repository.ts";

/** Use case: menghapus anggaran satu kategori dari menu Anggaran. Transaksinya tidak ikut terhapus. */
export class DeleteBudget {
  readonly #budgets: BudgetRepository;

  constructor(budgets: BudgetRepository) {
    this.#budgets = budgets;
  }

  async execute(userId: string, categoryId: string): Promise<void> {
    const deleted = await this.#budgets.delete(userId, categoryId);
    if (!deleted) throw new NotFoundError("Anggaran untuk kategori ini tidak ditemukan");
  }
}
