import { NotFoundError } from "../../../shared/domain/errors.ts";
import type { TransactionRepository } from "../domain/transaction-repository.ts";

/** Use case: menghapus transaksi (aksi "Hapus" di daftar transaksi). */
export class DeleteTransaction {
  readonly #repository: TransactionRepository;

  constructor(repository: TransactionRepository) {
    this.#repository = repository;
  }

  async execute(id: string): Promise<void> {
    const existing = await this.#repository.findById(id);
    if (!existing) throw new NotFoundError(`Transaksi ${id} tidak ditemukan`);
    await this.#repository.delete(id);
  }
}
