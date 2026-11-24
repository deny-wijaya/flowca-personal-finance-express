import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { HttpError } from "../http-error.ts";

/**
 * Membuat middleware yang membatasi jumlah request GAGAL per alamat IP dalam satu jendela waktu.
 * Dipakai untuk POST /auth/login supaya password tidak bisa ditebak berulang-ulang (PRD C5).
 *
 * - Request yang berhasil (status di bawah 400) tidak dihitung, jadi user yang login dengan benar
 *   tidak ikut terkunci.
 * - IP diambil dari `req.ip`. Karena `trust proxy` diatur di app.ts, `req.ip` berisi IP browser
 *   dari header X-Forwarded-For yang dikirim server Next, bukan IP server Next itu sendiri.
 * - Hitungan disimpan di memori proses. Cukup untuk satu instance server; kalau nanti ada beberapa
 *   instance, store-nya perlu dipindah ke Redis supaya hitungannya dibagi bersama.
 * - Saat batas terlampaui, library sudah memasang header Retry-After dan RateLimit, lalu kita
 *   melempar HttpError 429 supaya bentuk response-nya sama dengan error lain (lewat errorHandler).
 */
export function createFailedAttemptLimit(options: { windowMs: number; limit: number; message: string }): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new HttpError(429, "TOO_MANY_REQUESTS", options.message));
    },
  });
}
