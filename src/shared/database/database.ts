import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Membuat connection pool ke Postgres dan membungkusnya dengan Drizzle.
 * Pool membuka maksimal 10 koneksi lalu meminjamkannya bergantian ke setiap query,
 * jadi request tidak perlu membuka koneksi baru setiap kali.
 * Panggil `close()` saat server dimatikan supaya semua koneksi ditutup dengan rapi.
 */
export function createDatabase(url: string) {
  const pool = new Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool);
  return {
    db,
    close: () => pool.end(),
  };
}

export type Database = ReturnType<typeof createDatabase>["db"];
