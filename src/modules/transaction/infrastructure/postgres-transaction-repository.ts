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
 *
 * Setiap query menyertakan `user_id = <userId>`. Transaksi milik user lain tidak pernah terbaca,
 * tidak bisa diubah, dan tidak bisa dihapus, karena dari sudut pandang query baris itu tidak ada.
 */
export class PostgresTransactionRepository implements TransactionRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  async list(userId: string, filter: TransactionFilter = {}): Promise<Transaction[]> {
    // and() mengabaikan argumen undefined. Kalau semua filter kosong, Drizzle tidak menulis WHERE.
    return this.#db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          filter.from ? gte(transactions.occurredAt, filter.from) : undefined,
          filter.to ? lte(transactions.occurredAt, filter.to) : undefined,
          filter.type ? eq(transactions.type, filter.type) : undefined,
        ),
      )
      // Kolom kedua dan ketiga menentukan urutan transaksi yang terjadi di jam yang sama,
      // karena Postgres tidak menjamin urutan baris yang nilainya sama.
      .orderBy(desc(transactions.occurredAt), desc(transactions.createdAt), desc(transactions.id));
  }

  async findById(userId: string, id: string): Promise<Transaction | null> {
    // select selalu mengembalikan array, walaupun mencari berdasarkan primary key.
    const [row] = await this.#db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    return row ?? null;
  }

  async create(userId: string, input: NewTransaction): Promise<Transaction> {
    // returning() meminta Postgres mengembalikan baris yang baru disimpan,
    // termasuk created_at dan updated_at yang diisi oleh database.
    const [row] = await this.#db
      .insert(transactions)
      .values({ ...input, userId, id: `trx_${randomUUID()}` })
      .returning();
    if (!row) throw new Error("Insert transaksi tidak mengembalikan baris");
    return row;
  }

  async update(userId: string, id: string, data: NewTransaction): Promise<Transaction> {
    // updated_at memakai jam Postgres, sama dengan sumber jam created_at (defaultNow).
    const [row] = await this.#db
      .update(transactions)
      .set({ ...data, updatedAt: sql`now()` })
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning();
    if (!row) throw new Error(`Transaksi ${id} tidak ada di repository`);
    return row;
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.#db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  }
}
