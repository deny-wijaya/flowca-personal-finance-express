import { ConflictError, ValidationError } from "../../../shared/domain/errors.ts";
import type { TransactionType } from "./transaction.ts";

/**
 * Kategori transaksi (API-CONTRACT.md bagian 4.6).
 * Kategori bawaan punya `userId` null dan dipakai semua user. Kategori kustom dibuat user lewat
 * chip "+ Kategori baru" di form Tambah transaksi, dan hanya bisa dipakai oleh pembuatnya.
 */
export type Category = {
  id: string;
  /** null untuk kategori bawaan. */
  userId: string | null;
  name: string;
  type: TransactionType;
  createdAt: Date;
};

export type NewCategory = Pick<Category, "name" | "type">;

export const MAX_CATEGORY_NAME_LENGTH = 30;

/**
 * Kategori bawaan dalam urutan tampil. Id-nya tetap (bukan UUID), jadi frontend boleh memakainya
 * langsung, dan migration 0004 mengisi tabel `categories` dengan daftar yang sama.
 */
export const DEFAULT_CATEGORIES = [
  { id: "cat_expense_makanan", name: "Makanan", type: "expense" },
  { id: "cat_expense_transportasi", name: "Transportasi", type: "expense" },
  { id: "cat_expense_belanja", name: "Belanja", type: "expense" },
  { id: "cat_expense_tagihan", name: "Tagihan", type: "expense" },
  { id: "cat_expense_hiburan", name: "Hiburan", type: "expense" },
  { id: "cat_expense_kesehatan", name: "Kesehatan", type: "expense" },
  { id: "cat_expense_pendidikan", name: "Pendidikan", type: "expense" },
  { id: "cat_expense_lainnya", name: "Lainnya", type: "expense" },
  { id: "cat_income_gaji", name: "Gaji", type: "income" },
  { id: "cat_income_freelance", name: "Freelance", type: "income" },
  { id: "cat_income_bonus", name: "Bonus", type: "income" },
  { id: "cat_income_hadiah", name: "Hadiah", type: "income" },
  { id: "cat_income_investasi", name: "Investasi", type: "income" },
  { id: "cat_income_lainnya", name: "Lainnya", type: "income" },
] as const satisfies readonly { id: string; name: string; type: TransactionType }[];

/**
 * Waktu dibuat untuk kategori bawaan: 1 Jan 2000 ditambah urutannya dalam detik.
 * Daftar kategori diurutkan berdasarkan (created_at, id), jadi kategori bawaan selalu tampil
 * lebih dulu sesuai urutan di atas, lalu kategori kustom dari yang paling lama dibuat.
 */
export function defaultCategoryCreatedAt(index: number): Date {
  return new Date(Date.UTC(2000, 0, 1, 0, 0, index + 1));
}

/** "  Bayar   kos " -> "Bayar kos". */
export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function assertValidCategoryName(name: string): void {
  if (name.length === 0) throw new ValidationError("Nama kategori wajib diisi", "name");
  if (name.length > MAX_CATEGORY_NAME_LENGTH) {
    throw new ValidationError(`Nama kategori maksimal ${MAX_CATEGORY_NAME_LENGTH} karakter`, "name");
  }
}

/** Nama kategori sudah dipakai untuk jenis yang sama (bawaan atau milik user itu). HTTP 409. */
export class CategoryAlreadyExistsError extends ConflictError {
  constructor(name: string) {
    super(`Kategori ${name} sudah ada`, "CATEGORY_ALREADY_EXISTS", "name");
    this.name = "CategoryAlreadyExistsError";
  }
}

/**
 * Memastikan kategori boleh dipakai untuk transaksi dengan jenis `type`.
 * `category` null berarti kategori tidak ada ATAU milik user lain. Pesannya sengaja sama untuk
 * kedua kasus, supaya keberadaan kategori user lain tidak bocor.
 */
export function assertCategoryFits(category: Category | null, type: TransactionType): asserts category is Category {
  if (!category) throw new ValidationError("Kategori tidak ditemukan", "category_id");
  if (category.type !== type) {
    const label = type === "income" ? "pemasukan" : "pengeluaran";
    throw new ValidationError(`Kategori ${category.name} tidak bisa dipakai untuk ${label}`, "category_id");
  }
}
