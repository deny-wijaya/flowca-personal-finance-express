import { NotFoundError } from "../../../shared/domain/errors.ts";
import type { TransactionRepository } from "../domain/transaction-repository.ts";

/** Use case: menghapus transaksi (aksi "Hapus" di daftar transaksi). */
export class DeleteTransaction {
  readonly #repository: TransactionRepository;

  constructor(repository: TransactionRepository) {
    this.#repository = repository;
  }

  async execute(userId: string, id: string): Promise<void> {
    // Transaksi milik user lain juga menghasilkan null, jadi dibalas 404 yang sama.
    const existing = await this.#repository.findById(userId, id);
    if (!existing) throw new NotFoundError(`Transaksi ${id} tidak ditemukan`);
    await this.#repository.delete(userId, id);
  }
}
