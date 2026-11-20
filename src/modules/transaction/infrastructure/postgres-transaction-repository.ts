import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { Database } from "../../../shared/database/database.ts";
import type { NewTransaction, Transaction } from "../domain/transaction.ts";
import type { TransactionFilter, TransactionRepository } from "../domain/transaction-repository.ts";
import { transactions } from "./transaction.table.ts";

/**
 * Implementasi TransactionRepository yang menyimpan data di PostgreSQL lewat Drizzle.
 * Interface-nya sama persis dengan InMemoryTransactionRepository, jadi use case tidak berubah.
 * Bentuk satu baris tabel (`transactions.$inferSelect`) sama dengan type Transaction di domain,
 * sehingga hasil query bisa langsung dikembalikan tanpa diubah.
 */
export class PostgresTransactionRepository implements TransactionRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  async list(filter: TransactionFilter = {}): Promise<Transaction[]> {
    // and() mengabaikan argumen undefined. Kalau semua filter kosong, Drizzle tidak menulis WHERE.
    return this.#db
      .select()
      .from(transactions)
      .where(
        and(
          filter.from ? gte(transactions.occurredAt, filter.from) : undefined,
          filter.to ? lte(transactions.occurredAt, filter.to) : undefined,
          filter.type ? eq(transactions.type, filter.type) : undefined,
        ),
      )
      // Kolom kedua dan ketiga menentukan urutan transaksi yang terjadi di jam yang sama,
      // karena Postgres tidak menjamin urutan baris yang nilainya sama.
      .orderBy(desc(transactions.occurredAt), desc(transactions.createdAt), desc(transactions.id));
  }

  async findById(id: string): Promise<Transaction | null> {
    // select selalu mengembalikan array, walaupun mencari berdasarkan primary key.
    const [row] = await this.#db.select().from(transactions).where(eq(transactions.id, id));
    return row ?? null;
  }

  async create(input: NewTransaction): Promise<Transaction> {
    // returning() meminta Postgres mengembalikan baris yang baru disimpan,
    // termasuk created_at dan updated_at yang diisi oleh database.
    const [row] = await this.#db
      .insert(transactions)
      .values({ ...input, id: `trx_${randomUUID()}` })
      .returning();
    if (!row) throw new Error("Insert transaksi tidak mengembalikan baris");
    return row;
  }

  async update(id: string, data: NewTransaction): Promise<Transaction> {
    // updated_at memakai jam Postgres, sama dengan sumber jam created_at (defaultNow).
    const [row] = await this.#db
      .update(transactions)
      .set({ ...data, updatedAt: sql`now()` })
      .where(eq(transactions.id, id))
      .returning();
    if (!row) throw new Error(`Transaksi ${id} tidak ada di repository`);
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.#db.delete(transactions).where(eq(transactions.id, id));
  }
}
