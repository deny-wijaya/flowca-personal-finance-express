import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import type { Database } from "../../../shared/database/database.ts";
import { toPage, type PageRequest } from "../../../shared/domain/pagination.ts";
import type { NewTransaction, Transaction } from "../domain/transaction.ts";
import type {
  DateRange,
  TransactionCursor,
  TransactionFilter,
  TransactionPage,
  TransactionRepository,
  TransactionTotals,
} from "../domain/transaction-repository.ts";
import { categories, transactions } from "./transaction.table.ts";

/**
 * Kolom yang dibaca untuk satu Transaction. Nama kategori diambil lewat JOIN ke tabel categories,
 * karena tabel transactions hanya menyimpan category_id.
 */
const transactionColumns = {
  id: transactions.id,
  userId: transactions.userId,
  type: transactions.type,
  amount: transactions.amount,
  categoryId: transactions.categoryId,
  category: categories.name,
  note: transactions.note,
  occurredAt: transactions.occurredAt,
  createdAt: transactions.createdAt,
  updatedAt: transactions.updatedAt,
};

/**
 * Implementasi TransactionRepository yang menyimpan data di PostgreSQL lewat Drizzle.
 * Interface-nya sama persis dengan InMemoryTransactionRepository, jadi use case tidak berubah.
 * Setiap baca transaksi memakai `transactionColumns` (JOIN ke categories), jadi hasilnya langsung
 * berbentuk Transaction lengkap dengan nama kategori.
 *
 * Setiap query menyertakan `user_id = <userId>`. Transaksi milik user lain tidak pernah terbaca,
 * tidak bisa diubah, dan tidak bisa dihapus, karena dari sudut pandang query baris itu tidak ada.
 */
export class PostgresTransactionRepository implements TransactionRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  async list(userId: string, filter: TransactionFilter, page: PageRequest<TransactionCursor>): Promise<TransactionPage> {
    const { after } = page;
    // Cari dengan ILIKE '%kata%'. Karakter % dan _ punya arti khusus di LIKE, jadi di-escape dulu
    // supaya pencarian "50%" mencari teks "50%" apa adanya.
    const pattern = filter.q ? `%${filter.q.replace(/[\\%_]/g, "\\$&")}%` : undefined;

    // and() mengabaikan argumen undefined. Kalau semua filter kosong, hanya user_id yang tersisa.
    const rows = await this.#db
      .select(transactionColumns)
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .where(
        and(
          eq(transactions.userId, userId),
          filter.from ? gte(transactions.occurredAt, filter.from) : undefined,
          filter.to ? lte(transactions.occurredAt, filter.to) : undefined,
          filter.type ? eq(transactions.type, filter.type) : undefined,
          filter.categoryId ? eq(transactions.categoryId, filter.categoryId) : undefined,
          pattern ? or(ilike(transactions.note, pattern), ilike(categories.name, pattern)) : undefined,
          // Keyset pagination: ambil baris yang urutannya tepat sesudah transaksi terakhir di halaman
          // sebelumnya. Perbandingan baris (a, b) < (x, y) artinya a < x, atau a = x dan b < y.
          after
            ? sql`(${transactions.occurredAt}, ${transactions.id}) < (${after.occurredAt.toISOString()}::timestamptz, ${after.id})`
            : undefined,
        ),
      )
      // Urutan harus sama persis dengan kondisi keyset di atas. id menjadi penentu kalau occurred_at sama,
      // karena Postgres tidak menjamin urutan baris yang nilainya sama.
      .orderBy(desc(transactions.occurredAt), desc(transactions.id))
      // Ambil satu baris lebih untuk tahu apakah masih ada halaman berikutnya.
      .limit(page.limit + 1);

    return toPage(rows, page.limit, (trx) => ({ occurredAt: trx.occurredAt, id: trx.id }));
  }

  async findById(userId: string, id: string): Promise<Transaction | null> {
    // select selalu mengembalikan array, walaupun mencari berdasarkan primary key.
    const [row] = await this.#db
      .select(transactionColumns)
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    return row ?? null;
  }

  async create(userId: string, input: NewTransaction): Promise<Transaction> {
    // returning() meminta Postgres mengembalikan baris yang baru disimpan,
    // termasuk created_at dan updated_at yang diisi oleh database.
    const [row] = await this.#db
      .insert(transactions)
      .values({ ...input, userId, id: `trx_${randomUUID()}` })
      .returning({ id: transactions.id });
    // Dibaca ulang supaya hasilnya membawa nama kategori dari JOIN.
    const created = row && (await this.findById(userId, row.id));
    if (!created) throw new Error("Insert transaksi tidak mengembalikan baris");
    return created;
  }

  async update(userId: string, id: string, data: NewTransaction): Promise<Transaction> {
    // updated_at memakai jam Postgres, sama dengan sumber jam created_at (defaultNow).
    const [row] = await this.#db
      .update(transactions)
      .set({ ...data, updatedAt: sql`now()` })
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning({ id: transactions.id });
    const updated = row && (await this.findById(userId, row.id));
    if (!updated) throw new Error(`Transaksi ${id} tidak ada di repository`);
    return updated;
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.#db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  }

  async summarize(userId: string, range: DateRange): Promise<TransactionTotals> {
    const inRange = and(
      eq(transactions.userId, userId),
      gte(transactions.occurredAt, range.from),
      lte(transactions.occurredAt, range.to),
    );
    // SUM dari kolom bigint menghasilkan tipe numeric, yang dikirim driver pg sebagai string.
    // mapWith(Number) mengubahnya kembali menjadi number. coalesce mengganti NULL (tidak ada baris) dengan 0.
    const expenseSum = sql<number>`sum(${transactions.amount})`.mapWith(Number);

    const [totalsRows, categoryRows] = await Promise.all([
      // Query 1: satu baris berisi total pemasukan, total pengeluaran, dan jumlah transaksi.
      // FILTER (WHERE ...) membuat SUM hanya menjumlahkan baris dengan jenis tertentu.
      this.#db
        .select({
          totalIncome: sql<number>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'income'), 0)`.mapWith(Number),
          totalExpense: sql<number>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'expense'), 0)`.mapWith(Number),
          transactionCount: count(),
          // count(*) FILTER (WHERE ...) menghitung baris dengan jenis tertentu saja. Hasilnya bigint, jadi diubah ke number.
          incomeCount: sql<number>`count(*) filter (where ${transactions.type} = 'income')`.mapWith(Number),
          expenseCount: sql<number>`count(*) filter (where ${transactions.type} = 'expense')`.mapWith(Number),
        })
        .from(transactions)
        .where(inRange),
      // Query 2: satu baris per kategori pengeluaran (GROUP BY), urut dari nominal terbesar.
      // JOIN ke categories untuk mengambil namanya. GROUP BY id dan nama sekaligus, karena dua kategori
      // (misalnya "Lainnya" pemasukan dan pengeluaran) bisa punya nama sama.
      this.#db
        .select({ categoryId: categories.id, category: categories.name, amount: expenseSum })
        .from(transactions)
        .innerJoin(categories, eq(categories.id, transactions.categoryId))
        .where(and(inRange, eq(transactions.type, "expense")))
        .groupBy(categories.id, categories.name)
        .orderBy(desc(expenseSum), asc(categories.name)),
    ]);

    const totals = totalsRows[0] ?? { totalIncome: 0, totalExpense: 0, transactionCount: 0, incomeCount: 0, expenseCount: 0 };
    return { ...totals, expenseByCategory: categoryRows };
  }
}
