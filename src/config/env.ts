import { z } from "zod";

/**
 * Satu-satunya file yang membaca `process.env`.
 * Env divalidasi saat server start, jadi salah konfigurasi langsung ketahuan
 * sebelum server menerima request pertama.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  API_PREFIX: z.string().startsWith("/").default("/api/v1"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3200")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  // Wajib, tanpa default: server harus berhenti kalau lupa diisi, bukan diam-diam memakai database lain.
  DATABASE_URL: z.string().startsWith("postgres://", "DATABASE_URL harus diawali postgres://"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    console.error("Env tidak valid:", z.flattenError(parsed.error).fieldErrors);
    throw new Error("Konfigurasi env tidak valid. Cek file .env (lihat .env.example).");
  }
  return parsed.data;
}
