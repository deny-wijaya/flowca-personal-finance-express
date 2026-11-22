import { SignJWT } from "jose";
import type { AccessToken, TokenIssuer } from "../domain/token-issuer.ts";

/**
 * Membuat JWT bertanda tangan HS256 dengan library `jose`.
 * HS256 memakai satu kunci rahasia (JWT_SECRET) untuk membuat dan memeriksa tanda tangan.
 * Isi token bisa dibaca siapa saja (hanya di-encode base64, tidak dienkripsi),
 * jadi yang dimasukkan cukup `sub` (id user), `iat`, dan `exp`.
 */
export class JoseTokenIssuer implements TokenIssuer {
  readonly #key: Uint8Array;
  readonly #expiresIn: number;

  constructor(options: { secret: string; expiresIn: number }) {
    this.#key = new TextEncoder().encode(options.secret);
    this.#expiresIn = options.expiresIn;
  }

  async issue(userId: string): Promise<AccessToken> {
    const token = await new SignJWT()
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(`${this.#expiresIn}s`)
      .sign(this.#key);
    return { token, expiresIn: this.#expiresIn };
  }
}
