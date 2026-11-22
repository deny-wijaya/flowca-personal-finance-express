import type { NewUser, User } from "./user.ts";

/**
 * Kontrak penyimpanan user. Implementasinya ada di infrastructure (Postgres dan in-memory).
 */
export interface UserRepository {
  /** `email` harus sudah dinormalisasi (huruf kecil). */
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /**
   * Menyimpan user baru. Melempar EmailAlreadyRegisteredError kalau email sudah ada,
   * termasuk saat dua request register dengan email yang sama datang bersamaan.
   */
  create(input: NewUser): Promise<User>;
}
