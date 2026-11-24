import type { Page, PageRequest } from "../../../shared/domain/pagination.ts";
import type { Category, NewCategory } from "./category.ts";
import type { TransactionType } from "./transaction.ts";

/** Posisi kategori terakhir di satu halaman. Urutan daftar kategori adalah (createdAt, id). */
export type CategoryCursor = { createdAt: Date; id: string };

export type CategoryPage = Page<Category, CategoryCursor>;

/**
 * Kontrak penyimpanan kategori. Semua method menerima `userId` pemilik token, dan hanya melihat
 * kategori bawaan ditambah kategori kustom milik user itu.
 */
export interface CategoryRepository {
  /** Kategori bawaan dan milik `userId`, urut (createdAt, id). */
  list(userId: string, filter: { type?: TransactionType }, page: PageRequest<CategoryCursor>): Promise<CategoryPage>;
  /** null kalau kategori tidak ada atau milik user lain. */
  findById(userId: string, id: string): Promise<Category | null>;
  /** Melempar CategoryAlreadyExistsError kalau nama (tanpa beda huruf besar kecil) sudah ada untuk jenis itu. */
  create(userId: string, input: NewCategory): Promise<Category>;
}
