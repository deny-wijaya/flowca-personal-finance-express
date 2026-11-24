import { sql } from "drizzle-orm";
import { bigint, index, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { ACCOUNT_KINDS, MAX_ACCOUNT_NAME_LENGTH } from "../domain/account.ts";
import { MAX_CATEGORY_NAME_LENGTH } from "../domain/category.ts";
import { MAX_NOTE_LENGTH, TRANSACTION_TYPES } from "../domain/transaction.ts";

/**
 * Definisi tabel `transactions` dalam TypeScript.
 * File ini sumber kebenaran untuk dua hal: migration SQL (dibuat drizzle-kit)
 * dan tipe hasil query. Kiri = nama properti di TypeScript, argumen pertama = nama kolom di database.
 */
export const transactionType = pgEnum("transaction_type", TRANSACTION_TYPES);

export const accountKind = pgEnum("account_kind", ACCOUNT_KINDS);

/**
 * Akun (dompet) milik satu user. Saldo saat ini tidak disimpan: dihitung dari opening_balance dan
 * transaksi di akun itu (lihat PostgresAccountRepository.list).
 * Foreign key user_id ke users.id (ON DELETE CASCADE) ditulis langsung di migration 0006,
 * karena aturan arsitektur melarang file ini meng-import tabel users dari modul auth.
 */
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: varchar("name", { length: MAX_ACCOUNT_NAME_LENGTH }).notNull(),
    kind: accountKind("kind").notNull(),
    // Boleh negatif (utang kartu kredit). mode "number" sama seperti amount di transactions.
    openingBalance: bigint("opening_balance", { mode: "number" }).notNull(),
    // precision 3 (milidetik), sama dengan Date di JavaScript. created_at dipakai di cursor pagination;
    // dengan presisi bawaan (mikrodetik), cursor yang terpotong ke milidetik membuat akun muncul dua kali.
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  // Nama akun unik per user tanpa membedakan huruf besar kecil ("BCA" sama dengan "bca").
  (table) => [uniqueIndex("accounts_user_id_name_idx").on(table.userId, sql`lower(${table.name})`)],
);

/**
 * Kategori bawaan (user_id NULL, diisi oleh migration 0004) dan kategori kustom milik satu user.
 * Ditulis di file yang sama dengan tabel transactions karena keduanya bagian dari modul transaction,
 * dan transactions.category_id punya foreign key ke tabel ini.
 * Foreign key user_id ke users.id (ON DELETE CASCADE) ditulis langsung di migration 0004,
 * karena aturan arsitektur melarang file ini meng-import tabel users dari modul auth.
 */
export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    name: varchar("name", { length: MAX_CATEGORY_NAME_LENGTH }).notNull(),
    type: transactionType("type").notNull(),
    // precision 3 (milidetik) karena dipakai di cursor pagination, sama seperti accounts.created_at.
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  // Satu user tidak boleh punya dua kategori kustom dengan nama sama (tanpa beda huruf besar kecil)
  // untuk jenis yang sama. Index ini menjaga aturan itu walaupun dua request datang bersamaan.
  (table) => [uniqueIndex("categories_user_id_type_name_idx").on(table.userId, table.type, sql`lower(${table.name})`)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    // Pemilik transaksi. Foreign key ke users.id (ON DELETE CASCADE) ditulis langsung di
    // drizzle/0002_transactions_user_id.sql, karena aturan arsitektur melarang file ini meng-import
    // tabel users dari modul auth.
    userId: text("user_id").notNull(),
    type: transactionType("type").notNull(),
    // mode "number": tanpa ini driver pg mengembalikan bigint sebagai string.
    // Aman karena MAX_TRANSACTION_AMOUNT (Rp1 triliun) jauh di bawah Number.MAX_SAFE_INTEGER.
    amount: bigint("amount", { mode: "number" }).notNull(),
    // Diisi dari tabel categories. ON DELETE NO ACTION (bawaan Postgres): kategori yang masih dipakai
    // transaksi tidak bisa dihapus. Dipilih NO ACTION, bukan RESTRICT, karena NO ACTION dicek di akhir
    // statement, jadi saat user dihapus, kategori dan transaksinya bisa ikut terhapus bersamaan (cascade).
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    // Boleh kosong untuk transaksi lama yang dicatat sebelum fitur akun ada. Transaksi baru wajib
    // punya akun, dan aturan itu dicek di use case CreateTransaction. ON DELETE NO ACTION seperti kategori.
    accountId: text("account_id").references(() => accounts.id),
    note: varchar("note", { length: MAX_NOTE_LENGTH }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Dashboard dan menu Transaksi selalu memfilter berdasarkan pemilik, rentang occurred_at, lalu
  // mengurutkan per halaman dengan (occurred_at, id). Index gabungan dengan urutan kolom yang sama
  // membuat Postgres bisa langsung melompat ke posisi cursor tanpa membaca baris sebelumnya.
  // Index kedua dipakai saat menghitung saldo akun (SUM transaksi per account_id).
  (table) => [
    index("transactions_user_id_occurred_at_id_idx").on(table.userId, table.occurredAt, table.id),
    index("transactions_account_id_idx").on(table.accountId),
  ],
);

/**
 * Anggaran per kategori pengeluaran, berlaku setiap bulan sampai diubah (API-CONTRACT.md bagian 4.10).
 * Primary key gabungan (user_id, category_id) menjamin satu user hanya punya satu anggaran per kategori,
 * jadi tabel ini tidak butuh kolom id sendiri.
 * Foreign key user_id ke users.id (ON DELETE CASCADE) ditulis langsung di migration 0008.
 */
export const budgets = pgTable(
  "budgets",
  {
    userId: text("user_id").notNull(),
    // Anggaran tidak berarti tanpa kategorinya, jadi ikut terhapus kalau kategorinya dihapus.
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    // precision 3 (milidetik) karena dipakai di cursor pagination, sama seperti accounts.created_at.
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.categoryId] })],
);

