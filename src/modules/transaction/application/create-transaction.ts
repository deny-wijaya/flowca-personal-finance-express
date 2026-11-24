import { assertAccountFound } from "../domain/account.ts";
import type { AccountRepository } from "../domain/account-repository.ts";
import { assertCategoryFits } from "../domain/category.ts";
import type { CategoryRepository } from "../domain/category-repository.ts";
import { assertValidTransaction, type NewTransaction, type Transaction } from "../domain/transaction.ts";
import type { TransactionRepository } from "../domain/transaction-repository.ts";
import type { Clock } from "./clock.ts";

/** Use case: mencatat transaksi baru (form "Tambah transaksi" di menu Transaksi). */
export class CreateTransaction {
  readonly #repository: TransactionRepository;
  readonly #categories: CategoryRepository;
  readonly #accounts: AccountRepository;
  readonly #clock: Clock;

  constructor(repository: TransactionRepository, categories: CategoryRepository, accounts: AccountRepository, clock: Clock) {
    this.#repository = repository;
    this.#categories = categories;
    this.#accounts = accounts;
    this.#clock = clock;
  }

  async execute(userId: string, input: NewTransaction): Promise<Transaction> {
    assertValidTransaction(input, this.#clock.now());
    // Kategori harus bawaan atau milik user ini, dan jenisnya harus sama dengan jenis transaksi.
    assertCategoryFits(await this.#categories.findById(userId, input.categoryId), input.type);
    // Transaksi baru wajib punya akun milik user ini (API-CONTRACT.md bagian 4.9).
    assertAccountFound(input.accountId ? await this.#accounts.findById(userId, input.accountId) : null);
    return this.#repository.create(userId, input);
  }
}
