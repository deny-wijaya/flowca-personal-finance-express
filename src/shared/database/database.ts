import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Membuat connection pool ke Postgres dan membungkusnya dengan Drizzle.
 * Pool membuka maksimal 10 koneksi lalu meminjamkannya bergantian ke setiap query,
 * jadi request tidak perlu membuka koneksi baru setiap kali.
 * Panggil `close()` saat server dimatikan supaya semua koneksi ditutup dengan rapi.
 *
 * `onPoolError` dipanggil saat koneksi yang sedang menganggur di pool diputus Postgres, misalnya karena
 * Postgres di-restart atau Colima mati. pg.Pool memancarkan event "error" untuk kejadian itu, dan tanpa
 * handler, Node menganggapnya error tak tertangani lalu mematikan seluruh proses Express. Dengan handler,
 * koneksi yang putus dibuang dari pool, dan request berikutnya membuka koneksi baru setelah Postgres hidup.
 */
export function createDatabase(url: string, onPoolError: (error: Error) => void = defaultPoolErrorHandler) {
  const pool = new Pool({ connectionString: url, max: 10 });
  pool.on("error", onPoolError);
  const db = drizzle(pool);
  return {
    db,
    close: () => pool.end(),
  };
}

export type Database = ReturnType<typeof createDatabase>["db"];

function defaultPoolErrorHandler(error: Error) {
  console.error("[database] koneksi idle diputus Postgres:", error.message);
}
