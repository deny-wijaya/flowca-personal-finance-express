import { NotFoundError, ValidationError } from "../../../shared/domain/errors.ts";
import type { Category } from "./category.ts";
import { MAX_TRANSACTION_AMOUNT } from "./transaction.ts";

/**
 * Anggaran: batas pengeluaran satu kategori untuk satu user (API-CONTRACT.md bagian 4.10).
 * Berlaku setiap bulan sampai diubah, jadi tidak ada kolom bulan. Pengeluaran yang terpakai
 * tidak disimpan di sini; frontend mengambilnya dari GET /summary.
 */
export type Budget = {
  userId: string;
  categoryId: string;
  /** Nama kategori, dibaca lewat JOIN. */
  category: string;
  /** Batas per bulan dalam Rupiah, bilangan bulat lebih dari 0. */
  amount: number;
  createdAt: Date;
};

export function assertValidBudgetAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ValidationError("Nominal anggaran harus bilangan bulat lebih dari 0", "amount");
  }
  if (amount > MAX_TRANSACTION_AMOUNT) {
    throw new ValidationError("Nominal anggaran melebihi batas Rp 1.000.000.000.000", "amount");
  }
}

/**
 * Hanya kategori pengeluaran yang boleh dianggarkan. `category` null berarti kategori tidak ada atau
 * milik user lain; karena kategori menjadi bagian alamat endpoint (/budgets/:category_id), dibalas 404.
 */
export function assertBudgetableCategory(category: Category | null): asserts category is Category {
  if (!category) throw new NotFoundError("Kategori tidak ditemukan");
  if (category.type !== "expense") throw new ValidationError("Anggaran hanya untuk kategori pengeluaran", "category_id");
}
