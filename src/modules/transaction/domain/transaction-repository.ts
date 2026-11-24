import type { NewTransaction, Transaction, TransactionType } from "./transaction.ts";

export type TransactionFilter = {
  from?: Date;
  to?: Date;
  type?: TransactionType;
};

/**
 * Kontrak (interface) penyimpanan transaksi.
 * Use case hanya mengenal interface ini. Implementasinya ada di infrastructure (Postgres dan in-memory).
 *
 * Setiap method menerima `userId` sebagai argumen pertama, dan implementasinya wajib memfilter
 * berdasarkan pemilik. Dengan begitu tidak ada cara memanggil repository tanpa menyebut pemiliknya,
 * dan transaksi milik user lain diperlakukan sama seperti transaksi yang tidak ada.
 */
export interface TransactionRepository {
  /** Mengembalikan transaksi milik `userId` yang cocok dengan filter, urut dari `occurredAt` terbaru. */
  list(userId: string, filter?: TransactionFilter): Promise<Transaction[]>;
  /** `null` kalau transaksi tidak ada ATAU milik user lain. */
  findById(userId: string, id: string): Promise<Transaction | null>;
  create(userId: string, input: NewTransaction): Promise<Transaction>;
  update(userId: string, id: string, data: NewTransaction): Promise<Transaction>;
  delete(userId: string, id: string): Promise<void>;
}
