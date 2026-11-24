import { randomUUID } from "node:crypto";
import { toPage, type PageRequest } from "../../../shared/domain/pagination.ts";
import type { NewTransaction, Transaction } from "../domain/transaction.ts";
import type {
  BulkChanges,
  DateRange,
  TransactionCursor,
  TransactionFilter,
  TransactionPage,
  TransactionRepository,
  TransactionTotals,
} from "../domain/transaction-repository.ts";
import { InMemoryAccountRepository, type LedgerEntry } from "./in-memory-account-repository.ts";
import { InMemoryCategoryRepository } from "./in-memory-category-repository.ts";

/** Isi satu baris tabel transactions: sama dengan Transaction, tanpa nama kategori (didapat dari JOIN). */
export type StoredTransaction = Omit<Transaction, "category" | "account">;

/**
 * Implementasi repository yang menyimpan data di memori proses. Dipakai oleh test supaya tidak butuh Docker.
 * Perilakunya meniru PostgresTransactionRepository, termasuk pemisahan transaksi per user dan
 * nama kategori yang dibaca dari repository kategori (pengganti JOIN).
 */
export class InMemoryTransactionRepository implements TransactionRepository {
  readonly #rows = new Map<string, StoredTransaction>();
  readonly #categories: InMemoryCategoryRepository;
  readonly #accounts: InMemoryAccountRepository;

  constructor(
    seed: StoredTransaction[] = [],
    categories: InMemoryCategoryRepository = new InMemoryCategoryRepository(),
    accounts: InMemoryAccountRepository = new InMemoryAccountRepository(),
  ) {
    for (const row of seed) this.#rows.set(row.id, row);
    this.#categories = categories;
    this.#accounts = accounts;
  }

  /** Semua transaksi untuk menghitung saldo di InMemoryAccountRepository (pengganti SUM di Postgres). */
  ledger(): Iterable<LedgerEntry> {
    return this.#rows.values();
  }

  async list(userId: string, filter: TransactionFilter, page: PageRequest<TransactionCursor>): Promise<TransactionPage> {
    const after = page.after;
    const rows = this.#matching(userId, filter)
      .sort(newestFirst)
      // Sama dengan kondisi keyset di Postgres: hanya transaksi yang urutannya sesudah cursor.
      .filter((trx) => !after || newestFirst(trx, { ...after }) > 0);
    return toPage(rows.slice(0, page.limit + 1), page.limit, (trx) => ({ occurredAt: trx.occurredAt, id: trx.id }));
  }

  async findById(userId: string, id: string): Promise<Transaction | null> {
    const row = this.#rows.get(id);
    return row && row.userId === userId ? this.#withCategory(row) : null;
  }

  async create(userId: string, input: NewTransaction): Promise<Transaction> {
    const now = new Date();
    const row: StoredTransaction = { ...input, userId, id: `trx_${randomUUID()}`, createdAt: now, updatedAt: now };
    this.#rows.set(row.id, row);
    return this.#withCategory(row);
  }

  async update(userId: string, id: string, data: NewTransaction): Promise<Transaction> {
    const existing = this.#rows.get(id);
    if (!existing || existing.userId !== userId) throw new Error(`Transaksi ${id} tidak ada di repository`);
    const updated: StoredTransaction = { ...existing, ...data, updatedAt: new Date() };
    this.#rows.set(id, updated);
    return this.#withCategory(updated);
  }

  async delete(userId: string, id: string): Promise<void> {
    if (await this.findById(userId, id)) this.#rows.delete(id);
  }

  async findManyByIds(userId: string, ids: string[]): Promise<Transaction[]> {
    const wanted = new Set(ids);
    return [...this.#rows.values()].filter((row) => row.userId === userId && wanted.has(row.id)).map((row) => this.#withCategory(row));
  }

  async deleteAll(userId: string, ids: string[]): Promise<boolean> {
    // Meniru rollback: cek dulu semuanya ada, baru hapus.
    if ((await this.findManyByIds(userId, ids)).length !== ids.length) return false;
    for (const id of ids) this.#rows.delete(id);
    return true;
  }

  async updateAll(userId: string, ids: string[], changes: BulkChanges): Promise<boolean> {
    if ((await this.findManyByIds(userId, ids)).length !== ids.length) return false;
    const now = new Date();
    for (const id of ids) {
      const row = this.#rows.get(id)!;
      this.#rows.set(id, { ...row, ...changes, updatedAt: now });
    }
    return true;
  }

  async summarize(userId: string, range: DateRange): Promise<TransactionTotals> {
    const rows = this.#matching(userId, range);
    const expenseMap = new Map<string, { categoryId: string; category: string; amount: number }>();
    let totalIncome = 0;
    let totalExpense = 0;
    for (const trx of rows) {
      if (trx.type === "income") {
        totalIncome += trx.amount;
      } else {
        totalExpense += trx.amount;
        const item = expenseMap.get(trx.categoryId) ?? { categoryId: trx.categoryId, category: trx.category, amount: 0 };
        item.amount += trx.amount;
        expenseMap.set(trx.categoryId, item);
      }
    }
    // Urutan sama dengan query Postgres: nominal terbesar dulu, lalu nama kategori A-Z kalau nominalnya sama.
    const expenseByCategory = [...expenseMap.values()].sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
    const incomeCount = rows.filter((trx) => trx.type === "income").length;
    return { totalIncome, totalExpense, transactionCount: rows.length, incomeCount, expenseCount: rows.length - incomeCount, expenseByCategory };
  }

  #withCategory(row: StoredTransaction): Transaction {
    return { ...row, category: this.#categories.nameOf(row.categoryId), account: this.#accounts.nameOf(row.accountId) };
  }

  #matching(userId: string, filter: TransactionFilter): Transaction[] {
    const q = filter.q?.toLowerCase();
    return [...this.#rows.values()]
      .map((row) => this.#withCategory(row))
      .filter((trx) => {
        if (trx.userId !== userId) return false;
        const time = trx.occurredAt.getTime();
        if (filter.from && time < filter.from.getTime()) return false;
        if (filter.to && time > filter.to.getTime()) return false;
        if (filter.type && trx.type !== filter.type) return false;
        if (filter.categoryId && trx.categoryId !== filter.categoryId) return false;
        if (filter.accountId && trx.accountId !== filter.accountId) return false;
        if (q && !`${trx.note ?? ""} ${trx.category}`.toLowerCase().includes(q)) return false;
        return true;
      });
  }
}

/** Pembanding untuk sort: occurredAt terbaru dulu, lalu id terbesar. Hasil > 0 berarti `a` ditaruh sesudah `b`. */
function newestFirst(a: Pick<Transaction, "occurredAt" | "id">, b: Pick<Transaction, "occurredAt" | "id">): number {
  const byTime = b.occurredAt.getTime() - a.occurredAt.getTime();
  if (byTime !== 0) return byTime;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * Contoh data bulan berjalan (sama dengan mock di frontend) milik `userId`, supaya Dashboard langsung terisi.
 * Id-nya tetap per user (`seed-1-<userId>`), jadi script seed aman dijalankan berkali-kali.
 * Kategorinya memakai id kategori bawaan (DEFAULT_CATEGORIES), dan semuanya dicatat di akun `accountId`.
 */
export function createSeedTransactions(userId: string, accountId: string | null, now: Date = new Date()): StoredTransaction[] {
  const day = (d: number) => new Date(now.getFullYear(), now.getMonth(), Math.min(d, now.getDate()), 9);
  const rows: Omit<NewTransaction, "accountId">[] = [
    { type: "income", amount: 12_500_000, categoryId: "cat_income_gaji", note: "Gaji bulanan", occurredAt: day(1) },
    { type: "expense", amount: 1_850_000, categoryId: "cat_expense_tagihan", note: "Cicilan kos", occurredAt: day(2) },
    { type: "expense", amount: 450_000, categoryId: "cat_expense_tagihan", note: "Token listrik PLN", occurredAt: day(3) },
    { type: "expense", amount: 186_000, categoryId: "cat_expense_hiburan", note: "Netflix + Spotify", occurredAt: day(5) },
    { type: "expense", amount: 85_000, categoryId: "cat_expense_makanan", note: "Makan siang tim", occurredAt: day(6) },
    { type: "expense", amount: 64_000, categoryId: "cat_expense_transportasi", note: "Gojek ke kantor", occurredAt: day(6) },
    { type: "income", amount: 2_000_000, categoryId: "cat_income_freelance", note: "Landing page klien", occurredAt: day(8) },
    { type: "expense", amount: 742_500, categoryId: "cat_expense_belanja", note: "Belanja bulanan Superindo", occurredAt: day(9) },
  ];
  return rows.map((row, index) => ({
    ...row,
    accountId,
    userId,
    id: `seed-${index + 1}-${userId}`,
    createdAt: row.occurredAt,
    updatedAt: row.occurredAt,
  }));
}
