import { bigint, index, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { MAX_NOTE_LENGTH, TRANSACTION_TYPES } from "../domain/transaction.ts";

/**
 * Definisi tabel `transactions` dalam TypeScript.
 * File ini sumber kebenaran untuk dua hal: migration SQL (dibuat drizzle-kit)
 * dan tipe hasil query. Kiri = nama properti di TypeScript, argumen pertama = nama kolom di database.
 */
export const transactionType = pgEnum("transaction_type", TRANSACTION_TYPES);

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    type: transactionType("type").notNull(),
    // mode "number": tanpa ini driver pg mengembalikan bigint sebagai string.
    // Aman karena MAX_TRANSACTION_AMOUNT (Rp1 triliun) jauh di bawah Number.MAX_SAFE_INTEGER.
    amount: bigint("amount", { mode: "number" }).notNull(),
    category: text("category").notNull(),
    note: varchar("note", { length: MAX_NOTE_LENGTH }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Dashboard dan menu Transaksi selalu memfilter dan mengurutkan berdasarkan occurred_at.
  (table) => [index("transactions_occurred_at_idx").on(table.occurredAt)],
);
