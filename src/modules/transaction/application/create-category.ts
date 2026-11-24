import { assertValidCategoryName, normalizeCategoryName, type Category, type NewCategory } from "../domain/category.ts";
import type { CategoryRepository } from "../domain/category-repository.ts";

/** Use case: membuat kategori kustom dari chip "+ Kategori baru" di form Tambah transaksi. */
export class CreateCategory {
  readonly #repository: CategoryRepository;

  constructor(repository: CategoryRepository) {
    this.#repository = repository;
  }

  async execute(userId: string, input: NewCategory): Promise<Category> {
    const name = normalizeCategoryName(input.name);
    assertValidCategoryName(name);
    // Pengecekan nama dobel ada di repository, karena repository yang bisa menjamin aturan itu
    // tetap benar walaupun dua request datang bersamaan (lewat unique index di Postgres).
    return this.#repository.create(userId, { name, type: input.type });
  }
}
