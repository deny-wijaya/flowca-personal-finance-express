import type { PasswordHasher } from "../domain/password-hasher.ts";
import type { AccessToken, TokenIssuer } from "../domain/token-issuer.ts";
import type { UserRepository } from "../domain/user-repository.ts";
import { InvalidCredentialsError, normalizeEmail } from "../domain/user.ts";

/** Use case: masuk dengan email dan password dari layar Login (tombol "Masuk"). */
export class LoginUser {
  readonly #users: UserRepository;
  readonly #hasher: PasswordHasher;
  readonly #tokens: TokenIssuer;
  #dummyHash: Promise<string> | undefined;

  constructor(users: UserRepository, hasher: PasswordHasher, tokens: TokenIssuer) {
    this.#users = users;
    this.#hasher = hasher;
    this.#tokens = tokens;
  }

  async execute(input: { email: string; password: string }): Promise<AccessToken> {
    const user = await this.#users.findByEmail(normalizeEmail(input.email));

    // Kalau email tidak terdaftar, tetap jalankan verify ke hash palsu.
    // Tanpa ini, respons untuk email tidak terdaftar jauh lebih cepat (tanpa argon2),
    // sehingga penyerang bisa menebak email mana yang terdaftar dari waktu responsnya.
    const hash = user?.passwordHash ?? (await this.#getDummyHash());
    const passwordMatches = await this.#hasher.verify(hash, input.password);

    if (!user || !passwordMatches) throw new InvalidCredentialsError();
    return this.#tokens.issue(user.id);
  }

  /** Hash palsu dibuat sekali saja, saat pertama kali dibutuhkan. */
  #getDummyHash(): Promise<string> {
    this.#dummyHash ??= this.#hasher.hash("password-palsu-untuk-menyamakan-waktu");
    return this.#dummyHash;
  }
}
