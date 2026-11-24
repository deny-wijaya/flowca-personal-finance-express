import { DEFAULT_PAGE_LIMIT, type PageRequest } from "../../../shared/domain/pagination.ts";
import type { CategoryCursor, CategoryPage, CategoryRepository } from "../domain/category-repository.ts";
import type { TransactionType } from "../domain/transaction.ts";

/** Use case: daftar kategori untuk chip di form Tambah transaksi dan filter Kategori di menu Transaksi. */
export class ListCategories {
  readonly #repository: CategoryRepository;

  constructor(repository: CategoryRepository) {
    this.#repository = repository;
  }

  execute(
    userId: string,
    filter: { type?: TransactionType } = {},
    page: PageRequest<CategoryCursor> = { limit: DEFAULT_PAGE_LIMIT },
  ): Promise<CategoryPage> {
    return this.#repository.list(userId, filter, page);
  }
}
