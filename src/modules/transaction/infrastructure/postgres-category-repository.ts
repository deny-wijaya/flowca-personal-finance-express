import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import type { Database } from "../../../shared/database/database.ts";
import { isUniqueViolation } from "../../../shared/database/errors.ts";
import { toPage, type PageRequest } from "../../../shared/domain/pagination.ts";
import { CategoryAlreadyExistsError, type Category, type NewCategory } from "../domain/category.ts";
import type { CategoryCursor, CategoryPage, CategoryRepository } from "../domain/category-repository.ts";
import type { TransactionType } from "../domain/transaction.ts";
import { categories } from "./transaction.table.ts";

/**
 * Kategori di Postgres. Setiap query hanya melihat kategori bawaan (user_id NULL) dan
 * kategori milik `userId`, jadi kategori kustom user lain tidak pernah terbaca.
 */
export class PostgresCategoryRepository implements CategoryRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  async list(userId: string, filter: { type?: TransactionType }, page: PageRequest<CategoryCursor>): Promise<CategoryPage> {
    const { after } = page;
    const rows = await this.#db
      .select()
      .from(categories)
      .where(
        and(
          visibleTo(userId),
          filter.type ? eq(categories.type, filter.type) : undefined,
          // Keyset pagination, sama seperti daftar transaksi, tapi urutannya naik (yang lama dulu).
          after ? sql`(${categories.createdAt}, ${categories.id}) > (${after.createdAt.toISOString()}::timestamptz, ${after.id})` : undefined,
        ),
      )
      .orderBy(asc(categories.createdAt), asc(categories.id))
      .limit(page.limit + 1);
    return toPage(rows, page.limit, (category) => ({ createdAt: category.createdAt, id: category.id }));
  }

  async findById(userId: string, id: string): Promise<Category | null> {
    const [row] = await this.#db.select().from(categories).where(and(eq(categories.id, id), visibleTo(userId)));
    return row ?? null;
  }

  async create(userId: string, input: NewCategory): Promise<Category> {
    // Unique index hanya menjaga nama dobel di antara kategori milik user yang sama. Nama yang sama
    // dengan kategori bawaan (user_id NULL) dicek di sini, misalnya "makanan" untuk pengeluaran.
    const [existing] = await this.#db
      .select({ id: categories.id })
      .from(categories)
      .where(and(visibleTo(userId), eq(categories.type, input.type), sql`lower(${categories.name}) = lower(${input.name})`));
    if (existing) throw new CategoryAlreadyExistsError(input.name);

    try {
      const [row] = await this.#db
        .insert(categories)
        .values({ ...input, userId, id: `cat_${randomUUID()}` })
        .returning();
      if (!row) throw new Error("Insert kategori tidak mengembalikan baris");
      return row;
    } catch (error) {
      // Dua request dengan nama sama bisa sama-sama lolos pengecekan di atas. Yang kedua ditolak unique index.
      if (isUniqueViolation(error)) throw new CategoryAlreadyExistsError(input.name);
      throw error;
    }
  }
}

/** Kategori bawaan atau milik `userId`. */
function visibleTo(userId: string) {
  return or(isNull(categories.userId), eq(categories.userId, userId));
}
