import { ConflictError, ValidationError } from "../../../shared/domain/errors.ts";

/**
 * Entity User dan aturan bisnis register.
 * Aturan password di sini sama dengan `next-personal-finance/src/modules/auth/domain/password-policy.ts`.
 * Frontend memeriksanya supaya pesan muncul sebelum submit; backend memeriksanya lagi karena
 * request bisa dikirim langsung lewat curl atau Postman tanpa melewati form.
 */
export const MIN_PASSWORD_LENGTH = 8;
/** bcrypt hanya membaca 72 byte pertama. Batas ini dipakai supaya aturan tetap sama apa pun algoritma hash-nya. */
export const MAX_PASSWORD_LENGTH = 72;
export const MAX_NAME_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 254;

export type User = {
  id: string;
  name: string;
  /** Selalu huruf kecil, lihat `normalizeEmail`. */
  email: string;
  /** Hasil hash argon2, bukan password asli. Tidak pernah dikirim ke response. */
  passwordHash: string;
  createdAt: Date;
};

/** Data yang disimpan repository saat register. Id dan createdAt diisi oleh repository. */
export type NewUser = Pick<User, "name" | "email" | "passwordHash">;

/** Data mentah dari form Daftar. */
export type Registration = { name: string; email: string; password: string };

/** `" Rani@Email.com "` -> `"rani@email.com"`, supaya satu email tidak bisa terdaftar dua kali dengan huruf berbeda. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Aturan password. Melempar ValidationError dengan field "password" bila tidak dipenuhi. */
export function assertValidPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Password minimal ${MIN_PASSWORD_LENGTH} karakter`, "password");
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new ValidationError(`Password maksimal ${MAX_PASSWORD_LENGTH} karakter`, "password");
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new ValidationError("Password harus mengandung huruf dan angka", "password");
  }
  if (password.toLowerCase().includes("flowca")) {
    throw new ValidationError('Password tidak boleh mengandung kata "flowca"', "password");
  }
}

/** Dilempar saat email sudah dipakai akun lain. errorHandler membalasnya dengan 409. */
export class EmailAlreadyRegisteredError extends ConflictError {
  constructor() {
    super("Email sudah terdaftar. Silakan masuk.", "EMAIL_ALREADY_REGISTERED", "email");
    this.name = "EmailAlreadyRegisteredError";
  }
}
