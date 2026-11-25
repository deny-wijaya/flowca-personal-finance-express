import { NotFoundError } from "../../../shared/domain/errors.ts";
import { assertAccountFound } from "../domain/account.ts";
import type { AccountRepository } from "../domain/account-repository.ts";
import { assertCategoryFits } from "../domain/category.ts";
import type { CategoryRepository } from "../domain/category-repository.ts";
import type { BulkChanges, TransactionRepository } from "../domain/transaction-repository.ts";

const NOT_ALL_FOUND = "Sebagian transaksi tidak ditemukan. Tidak ada yang diubah.";

/** Use case: tombol Hapus di bar aksi massal tabel Transaksi (POST /transactions/bulk-delete). */
export class BulkDeleteTransactions {
  readonly #repository: TransactionRepository;

  constructor(repository: TransactionRepository) {
    this.#repository = repository;
  }

  async execute(userId: string, ids: string[]): Promise<number> {
    const unique = [...new Set(ids)];
    // Repository menjalankan DELETE di dalam satu transaksi database: semua terhapus, atau tidak ada sama sekali.
    if (!(await this.#repository.deleteAll(userId, unique))) throw new NotFoundError(NOT_ALL_FOUND);
    return unique.length;
  }
}

/** Use case: Ubah kategori dan Pindah akun di bar aksi massal tabel Transaksi (POST /transactions/bulk-update). */
export class BulkUpdateTransactions {
  readonly #repository: TransactionRepository;
  readonly #categories: CategoryRepository;
  readonly #accounts: AccountRepository;

  constructor(repository: TransactionRepository, categories: CategoryRepository, accounts: AccountRepository) {
    this.#repository = repository;
    this.#categories = categories;
    this.#accounts = accounts;
  }

  async execute(userId: string, ids: string[], changes: BulkChanges): Promise<number> {
    const unique = [...new Set(ids)];
    const transactions = await this.#repository.findManyByIds(userId, unique);
    if (transactions.length !== unique.length) throw new NotFoundError(NOT_ALL_FOUND);

    if (changes.categoryId !== undefined) {
      // Kategori harus cocok dengan jenis SETIAP transaksi, aturan yang sama dengan PATCH satu transaksi.
      const category = await this.#categories.findById(userId, changes.categoryId);
      for (const trx of transactions) assertCategoryFits(category, trx.type);
    }
    if (changes.accountId !== undefined) {
      assertAccountFound(await this.#accounts.findById(userId, changes.accountId));
    }

    // false kalau ada transaksi yang terhapus di antara pengecekan di atas dan UPDATE (misalnya dari HP).
    if (!(await this.#repository.updateAll(userId, unique, changes))) throw new NotFoundError(NOT_ALL_FOUND);
    return unique.length;
  }
}
