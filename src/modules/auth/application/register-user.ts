import type { PasswordHasher } from "../domain/password-hasher.ts";
import type { UserRepository } from "../domain/user-repository.ts";
import {
  assertValidPassword,
  EmailAlreadyRegisteredError,
  normalizeEmail,
  type Registration,
  type User,
} from "../domain/user.ts";

/** Use case: mendaftarkan akun baru dari layar Daftar (tombol "Daftar"). */
export class RegisterUser {
  readonly #users: UserRepository;
  readonly #hasher: PasswordHasher;

  constructor(users: UserRepository, hasher: PasswordHasher) {
    this.#users = users;
    this.#hasher = hasher;
  }

  async execute(input: Registration): Promise<User> {
    assertValidPassword(input.password);
    const email = normalizeEmail(input.email);

    // Cek awal supaya kasus umum (email sudah dipakai) tidak perlu menghitung hash yang lambat.
    // Ini tidak cukup untuk dua request yang datang bersamaan; yang menjaga kasus itu adalah
    // unique constraint di kolom email (lihat PostgresUserRepository.create).
    if (await this.#users.findByEmail(email)) throw new EmailAlreadyRegisteredError();

    const passwordHash = await this.#hasher.hash(input.password);
    // Persetujuan Syarat Layanan sudah dipastikan `true` oleh schema request; di sini waktunya dicatat.
    return this.#users.create({ name: input.name.trim(), email, passwordHash, termsAcceptedAt: new Date() });
  }
}
