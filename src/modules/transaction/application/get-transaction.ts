import { NotFoundError } from "../../../shared/domain/errors.ts";
import type { TransactionRepository } from "../domain/transaction-repository.ts";
import type { Transaction } from "../domain/transaction.ts";

export class GetTransaction {
  readonly #repository: TransactionRepository;

  constructor(repository: TransactionRepository) {
    this.#repository = repository;
  }

  async execute(id: string): Promise<Transaction> {
    const existing = await this.#repository.findById(id);
    if(!existing) throw new NotFoundError("Data Tidak ditemukan")
    return existing;
  }
}
