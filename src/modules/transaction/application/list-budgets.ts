import { DEFAULT_PAGE_LIMIT, type PageRequest } from "../../../shared/domain/pagination.ts";
import type { BudgetCursor, BudgetPage, BudgetRepository } from "../domain/budget-repository.ts";

/** Use case: daftar anggaran untuk menu Anggaran dan kartu Sisa anggaran di Dashboard. */
export class ListBudgets {
  readonly #repository: BudgetRepository;

  constructor(repository: BudgetRepository) {
    this.#repository = repository;
  }

  execute(userId: string, page: PageRequest<BudgetCursor> = { limit: DEFAULT_PAGE_LIMIT }): Promise<BudgetPage> {
    return this.#repository.list(userId, page);
  }
}
