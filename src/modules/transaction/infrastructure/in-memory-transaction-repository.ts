import { randomUUID } from "node:crypto";
import type { NewTransaction, Transaction } from "../domain/transaction.ts";
import type { TransactionFilter, TransactionRepository } from "../domain/transaction-repository.ts";

/**
 * Implementasi repository yang menyimpan data di memori proses. Dipakai oleh test supaya tidak butuh Docker.
 * Perilakunya meniru PostgresTransactionRepository, termasuk pemisahan transaksi per user.
 */
export class InMemoryTransactionRepository implements TransactionRepository {
  readonly #rows = new Map<string, Transaction>();

  constructor(seed: Transaction[] = []) {
    for (const row of seed) this.#rows.set(row.id, row);
  }

  async list(userId: string, filter: TransactionFilter = {}): Promise<Transaction[]> {
    return [...this.#rows.values()]
      .filter((trx) => {
        if (trx.userId !== userId) return false;
        const time = trx.occurredAt.getTime();
        if (filter.from && time < filter.from.getTime()) return false;
        if (filter.to && time > filter.to.getTime()) return false;
        if (filter.type && trx.type !== filter.type) return false;
        return true;
      })
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }

  async findById(userId: string, id: string): Promise<Transaction | null> {
    const row = this.#rows.get(id);
    return row && row.userId === userId ? row : null;
  }

  async create(userId: string, input: NewTransaction): Promise<Transaction> {
    const now = new Date();
    const transaction: Transaction = { ...input, userId, id: `trx_${randomUUID()}`, createdAt: now, updatedAt: now };
    this.#rows.set(transaction.id, transaction);
    return transaction;
  }

  async update(userId: string, id: string, data: NewTransaction): Promise<Transaction> {
    const existing = await this.findById(userId, id);
    if (!existing) throw new Error(`Transaksi ${id} tidak ada di repository`);
    const updated: Transaction = { ...existing, ...data, updatedAt: new Date() };
    this.#rows.set(id, updated);
    return updated;
  }

  async delete(userId: string, id: string): Promise<void> {
    if (await this.findById(userId, id)) this.#rows.delete(id);
  }
}

/**
 * Contoh data bulan berjalan (sama dengan mock di frontend) milik `userId`, supaya Dashboard langsung terisi.
 * Id-nya tetap per user (`seed-1-<userId>`), jadi script seed aman dijalankan berkali-kali.
 */
export function createSeedTransactions(userId: string, now: Date = new Date()): Transaction[] {
  const day = (d: number) => new Date(now.getFullYear(), now.getMonth(), Math.min(d, now.getDate()), 9);
  const rows: NewTransaction[] = [
    { type: "income", amount: 12_500_000, category: "Gaji", note: "Gaji bulanan", occurredAt: day(1) },
    { type: "expense", amount: 1_850_000, category: "Tagihan", note: "Cicilan kos", occurredAt: day(2) },
    { type: "expense", amount: 450_000, category: "Tagihan", note: "Token listrik PLN", occurredAt: day(3) },
    { type: "expense", amount: 186_000, category: "Hiburan", note: "Netflix + Spotify", occurredAt: day(5) },
    { type: "expense", amount: 85_000, category: "Makan & Minum", note: "Makan siang tim", occurredAt: day(6) },
    { type: "expense", amount: 64_000, category: "Transportasi", note: "Gojek ke kantor", occurredAt: day(6) },
    { type: "income", amount: 2_000_000, category: "Freelance", note: "Landing page klien", occurredAt: day(8) },
    { type: "expense", amount: 742_500, category: "Belanja", note: "Belanja bulanan Superindo", occurredAt: day(9) },
  ];
  return rows.map((row, index) => ({
    ...row,
    userId,
    id: `seed-${index + 1}-${userId}`,
    createdAt: row.occurredAt,
    updatedAt: row.occurredAt,
  }));
}
