import { z } from "zod";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../domain/pagination.ts";

/**
 * Bagian HTTP dari standar pagination (API-CONTRACT.md bagian 1): query `limit` dan `cursor`,
 * serta objek `page` di response. Dipakai oleh schema query setiap endpoint daftar.
 */
const LIMIT_MESSAGE = `limit harus bilangan bulat 1 sampai ${MAX_PAGE_LIMIT}`;

/** Query string selalu berupa teks, jadi `z.coerce` mengubah "20" menjadi angka 20 dulu. */
export const limitQuery = z.coerce
  .number({ message: LIMIT_MESSAGE })
  .int(LIMIT_MESSAGE)
  .min(1, LIMIT_MESSAGE)
  .max(MAX_PAGE_LIMIT, LIMIT_MESSAGE)
  .default(DEFAULT_PAGE_LIMIT);

/**
 * Cursor dikirim ke frontend sebagai teks base64url dari JSON, supaya frontend memperlakukannya
 * sebagai teks biasa dan tidak bergantung pada isinya. `shape` adalah schema isi cursor milik modul.
 * Teks yang rusak atau isinya tidak cocok dengan `shape` ditolak dengan pesan "Cursor tidak valid".
 */
export function cursorQuery<TShape extends z.ZodType>(shape: TShape) {
  return z.string().transform((value, ctx): z.infer<TShape> => {
    try {
      const parsed = shape.safeParse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
      if (parsed.success) return parsed.data;
    } catch {
      // JSON.parse gagal: teks cursor bukan buatan API ini. Ditangani di bawah.
    }
    ctx.addIssue({ code: "custom", message: "Cursor tidak valid" });
    return z.NEVER;
  });
}

export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

/** Objek `page` di response endpoint daftar. */
export function toPageDto(limit: number, nextCursor: string | null) {
  return { limit, next_cursor: nextCursor };
}
