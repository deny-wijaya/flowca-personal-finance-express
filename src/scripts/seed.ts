import { eq } from "drizzle-orm";
import { loadEnv } from "../config/env.ts";
import { normalizeEmail } from "../modules/auth/domain/user.ts";
import { users } from "../modules/auth/infrastructure/user.table.ts";
import { createSeedTransactions } from "../modules/transaction/infrastructure/in-memory-transaction-repository.ts";
import { transactions } from "../modules/transaction/infrastructure/transaction.table.ts";
import { createDatabase } from "../shared/database/database.ts";

/**
 * Mengisi 8 transaksi contoh (dengan kategori bawaan) bulan berjalan untuk satu user, supaya menu Dashboard dan Transaksi
 * langsung terisi setelah user itu login. Dijalankan manual dengan email pemiliknya:
 *
 *   npm run db:seed -- rani@email.com
 *
 * User harus sudah terdaftar (lewat layar Daftar). onConflictDoNothing melewati id yang sudah ada,
 * jadi script aman dijalankan berkali-kali untuk user yang sama.
 */
const email = process.argv[2];
if (!email) {
  console.error("Sebutkan email pemilik transaksi, contoh: npm run db:seed -- rani@email.com");
  process.exit(1);
}

const env = loadEnv();
const { db, close } = createDatabase(env.DATABASE_URL);

try {
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizeEmail(email)));
  if (!owner) {
    console.error(`User dengan email ${email} belum terdaftar. Daftar dulu lewat layar Daftar.`);
    process.exitCode = 1;
  } else {
    const inserted = await db
      .insert(transactions)
      .values(createSeedTransactions(owner.id))
      .onConflictDoNothing()
      .returning({ id: transactions.id });
    console.log(`Seed selesai: ${inserted.length} transaksi baru dimasukkan untuk ${email}.`);
  }
} finally {
  // Tanpa close(), pool tetap terbuka dan proses Node tidak pernah berhenti.
  await close();
}
