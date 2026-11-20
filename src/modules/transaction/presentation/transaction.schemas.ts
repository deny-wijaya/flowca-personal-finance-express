import { z } from "zod";
import { TRANSACTION_TYPES, type Transaction } from "../domain/transaction.ts";

/**
 * Schema request dan response sesuai kontrak API di docs/PRD.md bagian 6.
 * Di sini kita hanya mengecek BENTUK data (tipe, format tanggal, wajib/opsional).
 * Aturan bisnis (kategori valid, tanggal tidak di masa depan) dicek di domain.
 */
const isoDateTime = z.iso.datetime({ offset: true, message: "Harus tanggal ISO 8601, contoh 2026-11-14T08:00:00+07:00" });

export const listTransactionsQuerySchema = z
  .object({
    from: isoDateTime.transform((value) => new Date(value)).optional(),
    to: isoDateTime.transform((value) => new Date(value)).optional(),
    type: z.enum(TRANSACTION_TYPES).optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "`from` harus sebelum `to`", path: ["from"] });

export const transactionIdParamsSchema = z.object({ id: z.string().min(1) });

export const createTransactionBodySchema = z.object({
  type: z.enum(TRANSACTION_TYPES, { message: "Jenis harus income atau expense" }),
  amount: z.number({ message: "Nominal wajib berupa angka" }),
  category: z.string({ message: "Kategori wajib diisi" }).trim().min(1, "Kategori wajib diisi"),
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
    category: trx.category,
    note: trx.note,
    occurred_at: trx.occurredAt.toISOString(),
    created_at: trx.createdAt.toISOString(),
    updated_at: trx.updatedAt.toISOString(),
  };
}

export type TransactionDto = ReturnType<typeof toTransactionDto>;
