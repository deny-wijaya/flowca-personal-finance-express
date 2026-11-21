import { z } from "zod";
import { MAX_EMAIL_LENGTH, MAX_NAME_LENGTH, type User } from "../domain/user.ts";

/**
 * Schema request dan response sesuai docs/API-CONTRACT.md bagian 4.1.
 * Di sini hanya dicek BENTUK data (wajib diisi, format email, panjang).
 * Aturan password (huruf + angka, tanpa "flowca") adalah aturan bisnis, jadi dicek di domain.
 */
export const registerBodySchema = z.object({
  name: z
    .string({ message: "Nama lengkap wajib diisi" })
    .trim()
    .min(1, "Nama lengkap wajib diisi")
    .max(MAX_NAME_LENGTH, `Nama maksimal ${MAX_NAME_LENGTH} karakter`),
  email: z
    .string({ message: "Email wajib diisi" })
    .trim()
    .max(MAX_EMAIL_LENGTH, `Email maksimal ${MAX_EMAIL_LENGTH} karakter`)
    .pipe(z.email("Format email belum benar, contoh: nama@email.com")),
  // Tidak di-trim: spasi di awal atau akhir adalah bagian dari password.
  password: z.string({ message: "Password wajib diisi" }),
});

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
