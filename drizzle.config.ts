import { defineConfig } from "drizzle-kit";

// drizzle-kit tidak membaca .env sendiri. Nilai di shell tetap menang kalau DATABASE_URL sudah di-set.
// File ini di luar src/ (bukan kode aplikasi), jadi boleh membaca process.env langsung.
try {
  process.loadEnvFile();
} catch {
  // .env tidak wajib ada, misalnya di CI.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/*/infrastructure/*.table.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
