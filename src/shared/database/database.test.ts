import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDatabase } from "./database.ts";

/**
 * Test ke Postgres sungguhan (jalankan dengan `npm run test:db`). Membuktikan bahwa koneksi yang diputus
 * Postgres tidak mematikan proses: handler `onPoolError` dipanggil, dan query berikutnya tetap berhasil.
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("createDatabase", () => {
  it("koneksi idle yang diputus Postgres memanggil onPoolError, lalu pool membuka koneksi baru", async () => {
    const errors: Error[] = [];
    const { db, close } = createDatabase(url!, (error) => errors.push(error));
    const admin = createDatabase(url!);
    try {
      // Query pertama membuat satu koneksi, lalu koneksi itu kembali ke pool sebagai koneksi idle.
      const pid = ((await db.execute(sql`select pg_backend_pid() as pid`)).rows as { pid: number }[])[0]?.pid;
      // Sama seperti Postgres di-restart: koneksi idle itu diputus dari sisi server.
      await admin.db.execute(sql`select pg_terminate_backend(${pid})`);
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toMatch(/terminating connection/);
      // Pool membuang koneksi yang putus, jadi query berikutnya memakai koneksi baru.
      const again = await db.execute(sql`select 1 as ok`);
      expect(again.rows).toEqual([{ ok: 1 }]);
    } finally {
      await close();
      await admin.close();
    }
  });
});
