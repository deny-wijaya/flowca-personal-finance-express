import { z } from "zod";
import { TRANSACTION_TYPES, type Transaction } from "../domain/transaction.ts";
import type { Summary } from "../application/get-summary.ts";
import type { TransactionCursor } from "../domain/transaction-repository.ts";
import { cursorQuery, encodeCursor, limitQuery } from "../../../shared/http/pagination.ts";

/**
 * Schema request dan response sesuai kontrak API di docs/PRD.md bagian 6.
 * Di sini kita hanya mengecek BENTUK data (tipe, format tanggal, wajib/opsional).
 * Aturan bisnis (kategori valid, tanggal tidak di masa depan) dicek di domain.
 */
const isoDateTime = z.iso.datetime({ offset: true, message: "Harus tanggal ISO 8601, contoh 2026-11-14T08:00:00+07:00" });

/** Isi cursor transaksi sebelum di-encode: `o` = occurred_at, `i` = id. Nama pendek supaya cursor tidak panjang. */
function transactionCursorShape() {
  return z
    .object({ o: z.iso.datetime(), i: z.string().min(1) })
    .transform((c): TransactionCursor => ({ occurredAt: new Date(c.o), id: c.i }));
}

export function encodeTransactionCursor(cursor: TransactionCursor): string {
  return encodeCursor({ o: cursor.occurredAt.toISOString(), i: cursor.id });
}

export const listTransactionsQuerySchema = z
  .object({
    from: isoDateTime.transform((value) => new Date(value)).optional(),
    to: isoDateTime.transform((value) => new Date(value)).optional(),
    type: z.enum(TRANSACTION_TYPES).optional(),
    category_id: z.string().trim().min(1, "Kategori tidak boleh kosong").optional(),
    account_id: z.string().trim().min(1, "Akun tidak boleh kosong").optional(),
    q: z.string().trim().min(1, "Kata pencarian tidak boleh kosong").max(100, "Kata pencarian maksimal 100 karakter").optional(),
    limit: limitQuery,
    cursor: cursorQuery(transactionCursorShape()).optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "`from` harus sebelum `to`", path: ["from"] });

/** Query GET /summary: from dan to wajib, karena ringkasan selalu untuk satu periode tertentu. */
export const summaryQuerySchema = z
  .object({
    from: isoDateTime.transform((value) => new Date(value)),
    to: isoDateTime.transform((value) => new Date(value)),
  })
  .refine((q) => q.from <= q.to, { message: "`from` harus sebelum `to`", path: ["from"] });

export const transactionIdParamsSchema = z.object({ id: z.string().min(1) });

export const createTransactionBodySchema = z.object({
  type: z.enum(TRANSACTION_TYPES, { message: "Jenis harus income atau expense" }),
  amount: z.number({ message: "Nominal wajib berupa angka" }),
  category_id: z.string({ message: "Kategori wajib diisi" }).trim().min(1, "Kategori wajib diisi"),
  account_id: z.string({ message: "Akun wajib diisi" }).trim().min(1, "Akun wajib diisi"),
  note: z.string().trim().nullish().transform((value) => value || null),
  occurred_at: isoDateTime.transform((value) => new Date(value)),
});

export const updateTransactionBodySchema = createTransactionBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "Minimal satu field harus diubah" });

/** Mengubah entity (camelCase, Date) menjadi DTO response (snake_case, ISO string). */
export function toTransactionDto(trx: Transaction) {
  return {
    id: trx.id,
    type: trx.type,
    amount: trx.amount,
    category_id: trx.categoryId,
    category: trx.category,
    account_id: trx.accountId,
    account: trx.account,
    note: trx.note,
    occurred_at: trx.occurredAt.toISOString(),
    created_at: trx.createdAt.toISOString(),
    updated_at: trx.updatedAt.toISOString(),
  };
}

export type TransactionDto = ReturnType<typeof toTransactionDto>;

/** Mengubah hasil GetSummary menjadi DTO response GET /summary (API-CONTRACT.md bagian 4.5). */
export function toSummaryDto(summary: Summary) {
  return {
    total_income: summary.totalIncome,
    total_expense: summary.totalExpense,
    net_cashflow: summary.netCashflow,
    transaction_count: summary.transactionCount,
    income_count: summary.incomeCount,
    expense_count: summary.expenseCount,
    expense_by_category: summary.expenseByCategory.map((item) => ({
      category_id: item.categoryId,
      category: item.category,
      amount: item.amount,
    })),
  };
}
