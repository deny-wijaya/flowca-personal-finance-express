import { assertCategoryFits } from "../domain/category.ts";
import type { CategoryRepository } from "../domain/category-repository.ts";
import { assertValidTransaction, type NewTransaction, type Transaction } from "../domain/transaction.ts";
import type { TransactionRepository } from "../domain/transaction-repository.ts";
import type { Clock } from "./clock.ts";

/** Use case: mencatat transaksi baru (form "Tambah transaksi" di menu Transaksi). */
export class CreateTransaction {
  readonly #repository: TransactionRepository;
  readonly #categories: CategoryRepository;
  readonly #clock: Clock;

  constructor(repository: TransactionRepository, categories: CategoryRepository, clock: Clock) {
    this.#repository = repository;
    this.#categories = categories;
    this.#clock = clock;
  }

  async execute(userId: string, input: NewTransaction): Promise<Transaction> {
    assertValidTransaction(input, this.#clock.now());
    // Kategori harus bawaan atau milik user ini, dan jenisnya harus sama dengan jenis transaksi.
    assertCategoryFits(await this.#categories.findById(userId, input.categoryId), input.type);
    return this.#repository.create(userId, input);
  }
}
