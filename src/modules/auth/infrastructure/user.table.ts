import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Definisi tabel `users`. Kolom `email` diberi unique constraint, jadi Postgres sendiri
 * yang menolak email kembar, termasuk saat dua request register datang di detik yang sama.
 * Unique constraint otomatis membuat index, jadi pencarian login berdasarkan email tetap cepat.
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Waktu user mencentang persetujuan Syarat Layanan saat Daftar. NULL untuk user yang mendaftar
  // sebelum kolom ini ada, karena waktu persetujuan mereka tidak tercatat.
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
});
