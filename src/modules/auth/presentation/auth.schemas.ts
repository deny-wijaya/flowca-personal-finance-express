import { z } from "zod";
import type { AccessToken } from "../domain/token-issuer.ts";
import { MAX_EMAIL_LENGTH, MAX_NAME_LENGTH, type User } from "../domain/user.ts";

/**
 * Schema request dan response sesuai docs/API-CONTRACT.md bagian 4.1 (register) dan 4.2 (login).
 * Di sini hanya dicek BENTUK data (wajib diisi, format email, panjang).
 * Aturan password (huruf + angka, tanpa "flowca") adalah aturan bisnis, jadi dicek di domain.
 */
/** Aturan nama dipakai bersama oleh register dan PATCH /auth/me; hanya pesan "wajib diisi" yang berbeda. */
function nameSchema(requiredMessage: string) {
  return z
    .string({ message: requiredMessage })
    .trim()
    .min(1, requiredMessage)
    .max(MAX_NAME_LENGTH, `Nama maksimal ${MAX_NAME_LENGTH} karakter`);
}

const TERMS_MESSAGE = "Kamu perlu menyetujui Syarat Layanan dan Kebijakan Privasi";

export const registerBodySchema = z.object({
  name: nameSchema("Nama lengkap wajib diisi"),
  terms_accepted: z.literal(true, { message: TERMS_MESSAGE }),
  email: z
    .string({ message: "Email wajib diisi" })
    .trim()
    .max(MAX_EMAIL_LENGTH, `Email maksimal ${MAX_EMAIL_LENGTH} karakter`)
    .pipe(z.email("Format email belum benar, contoh: nama@email.com")),
  // Tidak di-trim: spasi di awal atau akhir adalah bagian dari password.
  password: z.string({ message: "Password wajib diisi" }),
});

/** Login hanya memeriksa bentuk. Aturan password tidak dicek di sini, karena password cukup dicocokkan dengan hash. */
/** Body PATCH /auth/me (API-CONTRACT.md bagian 4.3). Hanya nama yang bisa diubah. */
export const updateProfileBodySchema = z.object({ name: nameSchema("Nama wajib diisi") });

export const loginBodySchema = z.object({
  email: z
    .string({ message: "Email wajib diisi" })
    .trim()
    .min(1, "Email wajib diisi")
    .pipe(z.email("Format email belum benar, contoh: nama@email.com")),
  password: z.string({ message: "Password wajib diisi" }).min(1, "Password wajib diisi"),
});

export function toAccessTokenDto(accessToken: AccessToken) {
  return { access_token: accessToken.token, expires_in: accessToken.expiresIn };
}

/** Mengubah entity menjadi DTO response. `passwordHash` sengaja tidak ikut. */
export function toUserDto(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.createdAt.toISOString(),
  };
}

export type UserDto = ReturnType<typeof toUserDto>;
