import type { NewTransaction, Transaction, TransactionType } from "./transaction.ts";

export type TransactionFilter = {
  from?: Date;
  to?: Date;
  type?: TransactionType;
};

/**
 * Kontrak (interface) penyimpanan transaksi.
 * Use case hanya mengenal interface ini. Implementasinya ada di infrastructure:
 * sekarang in-memory, nanti PostgreSQL. Mengganti database tidak mengubah use case.
 */
export interface TransactionRepository {
  /** Mengembalikan transaksi yang cocok dengan filter, urut dari `occurredAt` terbaru. */
  list(filter?: TransactionFilter): Promise<Transaction[]>;
  findById(id: string): Promise<Transaction | null>;
  create(input: NewTransaction): Promise<Transaction>;
  update(id: string, data: NewTransaction): Promise<Transaction>;
  delete(id: string): Promise<void>;
}
