import type { Page, PageRequest } from "../../../shared/domain/pagination.ts";
import type { Budget } from "./budget.ts";

/** Posisi anggaran terakhir di satu halaman. Urutan daftar anggaran adalah (createdAt, categoryId). */
export type BudgetCursor = { createdAt: Date; categoryId: string };

export type BudgetPage = Page<Budget, BudgetCursor>;

/** Kontrak penyimpanan anggaran. Satu user punya paling banyak satu anggaran per kategori. */
export interface BudgetRepository {
  list(userId: string, page: PageRequest<BudgetCursor>): Promise<BudgetPage>;
  /** Membuat anggaran kategori itu, atau mengganti nominalnya kalau sudah ada (upsert). */
  upsert(userId: string, categoryId: string, amount: number): Promise<Budget>;
  /** true kalau ada anggaran yang dihapus, false kalau kategori itu memang tidak punya anggaran. */
  delete(userId: string, categoryId: string): Promise<boolean>;
}
