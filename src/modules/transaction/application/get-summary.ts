import type { DateRange, TransactionRepository, TransactionTotals } from "../domain/transaction-repository.ts";

export type Summary = TransactionTotals & {
  /** totalIncome - totalExpense, bisa negatif kalau pengeluaran lebih besar. */
  netCashflow: number;
};

/**
 * Use case: ringkasan satu periode untuk menu Dashboard (kartu pemasukan, pengeluaran, arus kas,
 * dan pengeluaran per kategori) dan menu Transaksi (jumlah transaksi bulan ini).
 * Penjumlahan dikerjakan repository (di Postgres memakai SUM dan GROUP BY), jadi use case tidak
 * perlu mengambil semua transaksi ke memori.
 */
export class GetSummary {
  readonly #repository: TransactionRepository;

  constructor(repository: TransactionRepository) {
    this.#repository = repository;
  }

  async execute(userId: string, range: DateRange): Promise<Summary> {
    const totals = await this.#repository.summarize(userId, range);
    return { ...totals, netCashflow: totals.totalIncome - totals.totalExpense };
  }
}
