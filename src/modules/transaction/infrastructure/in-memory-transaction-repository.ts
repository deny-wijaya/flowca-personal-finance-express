import { randomUUID } from "node:crypto";
import type { NewTransaction, Transaction } from "../domain/transaction.ts";
import type { TransactionFilter, TransactionRepository } from "../domain/transaction-repository.ts";

/**
 * Implementasi repository yang menyimpan data di memori proses.
 * Data hilang setiap server restart. Dipakai untuk fase awal dan untuk test.
 * Di Fase 1 (lihat docs/PRD.md) kita menambah PostgresTransactionRepository
 * dengan interface yang sama, lalu cukup mengganti pilihan di di/container.ts.
 */
export class InMemoryTransactionRepository implements TransactionRepository {
  readonly #rows = new Map<string, Transaction>();

  constructor(seed: Transaction[] = []) {
    for (const row of seed) this.#rows.set(row.id, row);
  }

  async list(filter: TransactionFilter = {}): Promise<Transaction[]> {
    return [...this.#rows.values()]
      .filter((trx) => {
        const time = trx.occurredAt.getTime();
        if (filter.from && time < filter.from.getTime()) return false;
        if (filter.to && time > filter.to.getTime()) return false;
        if (filter.type && trx.type !== filter.type) return false;
        return true;
      })
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.#rows.get(id) ?? null;
  }

  async create(input: NewTransaction): Promise<Transaction> {
    const now = new Date();
    const transaction: Transaction = { ...input, id: `trx_${randomUUID()}`, createdAt: now, updatedAt: now };
    this.#rows.set(transaction.id, transaction);
    return transaction;
  }

  async update(id: string, data: NewTransaction): Promise<Transaction> {
    const existing = this.#rows.get(id);
    if (!existing) throw new Error(`Transaksi ${id} tidak ada di repository`);
    const updated: Transaction = { ...existing, ...data, updatedAt: new Date() };
    this.#rows.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.#rows.delete(id);
  }
}

/** Contoh data bulan berjalan (sama dengan mock di frontend), supaya Dashboard langsung terisi. */
export function createSeedTransactions(now: Date = new Date()): Transaction[] {
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
  return rows.map((row, index) => ({ ...row, id: `seed-${index + 1}`, createdAt: row.occurredAt, updatedAt: row.occurredAt }));
}
