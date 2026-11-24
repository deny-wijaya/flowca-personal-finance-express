import { NotFoundError } from "../../../shared/domain/errors.ts";
import { assertValidTransaction, type Transaction, type TransactionChanges } from "../domain/transaction.ts";
import type { TransactionRepository } from "../domain/transaction-repository.ts";
import type { Clock } from "./clock.ts";

/** Use case: mengubah transaksi yang salah input (aksi "Ubah" di daftar transaksi). */
export class UpdateTransaction {
  readonly #repository: TransactionRepository;
  readonly #clock: Clock;

  constructor(repository: TransactionRepository, clock: Clock) {
    this.#repository = repository;
    this.#clock = clock;
  }

  async execute(userId: string, id: string, changes: TransactionChanges): Promise<Transaction> {
    const existing = await this.#repository.findById(userId, id);
    if (!existing) throw new NotFoundError(`Transaksi ${id} tidak ditemukan`);

    // Gabungkan data lama dengan perubahan, lalu validasi hasil akhirnya.
    // Contoh: mengubah type ke "income" tanpa mengganti kategori "Transportasi" akan ditolak.
    const merged = {
      type: changes.type ?? existing.type,
      amount: changes.amount ?? existing.amount,
      category: changes.category ?? existing.category,
      note: changes.note !== undefined ? changes.note : existing.note,
      occurredAt: changes.occurredAt ?? existing.occurredAt,
    };
    assertValidTransaction(merged, this.#clock.now());
    return this.#repository.update(userId, id, merged);
  }
}
