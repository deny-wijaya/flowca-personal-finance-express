import { assertValidTransaction, type NewTransaction, type Transaction } from "../domain/transaction.ts";
import type { TransactionRepository } from "../domain/transaction-repository.ts";
import type { Clock } from "./clock.ts";

/** Use case: mencatat transaksi baru (form "Tambah transaksi" di menu Transaksi). */
export class CreateTransaction {
  readonly #repository: TransactionRepository;
  readonly #clock: Clock;

  constructor(repository: TransactionRepository, clock: Clock) {
    this.#repository = repository;
    this.#clock = clock;
  }

  async execute(userId: string, input: NewTransaction): Promise<Transaction> {
    assertValidTransaction(input, this.#clock.now());
    return this.#repository.create(userId, input);
  }
}
