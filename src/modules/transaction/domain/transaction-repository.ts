import type { Page, PageRequest } from "../../../shared/domain/pagination.ts";
import type { NewTransaction, Transaction, TransactionType } from "./transaction.ts";

export type TransactionFilter = {
  from?: Date;
  to?: Date;
  type?: TransactionType;
  /** Id kategori, misalnya "cat_expense_transportasi". */
  categoryId?: string;
  /** Id akun. */
  accountId?: string;
  /** Kata pencarian di catatan dan nama kategori, tanpa membedakan huruf besar dan kecil. */
  q?: string;
};

/**
 * Posisi transaksi terakhir di satu halaman. Halaman berikutnya dimulai dari transaksi yang urutannya
 * tepat sesudah posisi ini. `id` ikut disimpan karena beberapa transaksi bisa punya `occurredAt` yang sama.
 */
export type TransactionCursor = { occurredAt: Date; id: string };

export type TransactionPage = Page<Transaction, TransactionCursor>;

/** Rentang waktu `occurredAt`, kedua batasnya inklusif. */
export type DateRange = { from: Date; to: Date };

/** Hasil hitungan database untuk satu periode. Arus kas bersih dihitung di use case GetSummary. */
export type TransactionTotals = {
  totalIncome: number;
  totalExpense: number;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
  /** Pengeluaran per kategori, urut dari nominal terbesar. Kategori tanpa pengeluaran tidak ikut. */
  expenseByCategory: { categoryId: string; category: string; amount: number }[];
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
  /**
   * Mengembalikan satu halaman transaksi milik `userId` yang cocok dengan filter.
   * Urutannya `occurredAt` terbaru, lalu `id` terbesar kalau `occurredAt` sama.
   */
  list(userId: string, filter: TransactionFilter, page: PageRequest<TransactionCursor>): Promise<TransactionPage>;
  /** `null` kalau transaksi tidak ada ATAU milik user lain. */
  findById(userId: string, id: string): Promise<Transaction | null>;
  create(userId: string, input: NewTransaction): Promise<Transaction>;
  update(userId: string, id: string, data: NewTransaction): Promise<Transaction>;
  delete(userId: string, id: string): Promise<void>;
  /** Menjumlahkan transaksi milik `userId` di rentang `range`. Semua angka 0 kalau tidak ada transaksi. */
  summarize(userId: string, range: DateRange): Promise<TransactionTotals>;
}
