import { NotFoundError } from "../../../shared/domain/errors.ts";
import { assertAccountFound } from "../domain/account.ts";
import type { AccountRepository } from "../domain/account-repository.ts";
import { assertCategoryFits } from "../domain/category.ts";
import type { CategoryRepository } from "../domain/category-repository.ts";
import { assertValidTransaction, type Transaction, type TransactionChanges } from "../domain/transaction.ts";
import type { TransactionRepository } from "../domain/transaction-repository.ts";
import type { Clock } from "./clock.ts";

/** Use case: mengubah transaksi yang salah input (aksi "Ubah" di daftar transaksi). */
export class UpdateTransaction {
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

  async execute(userId: string, id: string, changes: TransactionChanges): Promise<Transaction> {
    const existing = await this.#repository.findById(userId, id);
    if (!existing) throw new NotFoundError(`Transaksi ${id} tidak ditemukan`);

    // Gabungkan data lama dengan perubahan, lalu validasi hasil akhirnya.
    // Contoh: mengubah type ke "income" tanpa mengganti kategori Transportasi akan ditolak.
    const merged = {
      type: changes.type ?? existing.type,
      amount: changes.amount ?? existing.amount,
      categoryId: changes.categoryId ?? existing.categoryId,
      accountId: changes.accountId ?? existing.accountId,
      note: changes.note !== undefined ? changes.note : existing.note,
      occurredAt: changes.occurredAt ?? existing.occurredAt,
    };
    assertValidTransaction(merged, this.#clock.now());
    assertCategoryFits(await this.#categories.findById(userId, merged.categoryId), merged.type);
    // Akun baru dicek kalau diganti. Transaksi lama tanpa akun boleh tetap tanpa akun.
    if (changes.accountId !== undefined) assertAccountFound(await this.#accounts.findById(userId, changes.accountId ?? ""));
    return this.#repository.update(userId, id, merged);
  }
}
