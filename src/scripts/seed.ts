import { loadEnv } from "../config/env.ts";
import { createSeedTransactions } from "../modules/transaction/infrastructure/in-memory-transaction-repository.ts";
import { transactions } from "../modules/transaction/infrastructure/transaction.table.ts";
import { createDatabase } from "../shared/database/database.ts";

/**
 * Mengisi 8 transaksi contoh bulan berjalan (seed-1 sampai seed-8) ke database di DATABASE_URL,
 * supaya menu Dashboard dan Transaksi langsung terisi. Dijalankan manual: `npm run db:seed`.
 * onConflictDoNothing melewati id yang sudah ada, jadi script aman dijalankan berkali-kali.
 */
const env = loadEnv();
const { db, close } = createDatabase(env.DATABASE_URL);

try {
  const inserted = await db
    .insert(transactions)
    .values(createSeedTransactions())
    .onConflictDoNothing()
    .returning({ id: transactions.id });
  console.log(`Seed selesai: ${inserted.length} transaksi baru dimasukkan.`);
} finally {
  // Tanpa close(), pool tetap terbuka dan proses Node tidak pernah berhenti.
  await close();
}
