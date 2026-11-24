import type { Transaction } from "../domain/transaction.ts";
import type { TransactionFilter, TransactionRepository } from "../domain/transaction-repository.ts";

/** Use case: menampilkan daftar transaksi (dipakai menu Transaksi dan Dashboard di frontend). */
export class ListTransactions {
  readonly #repository: TransactionRepository;

  constructor(repository: TransactionRepository) {
    this.#repository = repository;
  }

  execute(userId: string, filter: TransactionFilter = {}): Promise<Transaction[]> {
    return this.#repository.list(userId, filter);
  }
}
