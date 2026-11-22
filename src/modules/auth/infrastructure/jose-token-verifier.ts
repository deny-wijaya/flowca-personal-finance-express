import { jwtVerify } from "jose";
import { UnauthorizedError } from "../../../shared/domain/errors.ts";
import type { AuthContext, TokenVerifier } from "../domain/token-verifier.ts";

/** Pesan yang sama untuk semua alasan token ditolak. Detail alasannya tidak perlu diketahui client. */
export const INVALID_TOKEN_MESSAGE = "Sesi kamu sudah habis. Silakan masuk lagi.";

/**
 * Memeriksa JWT buatan JoseTokenIssuer dengan secret yang sama.
 * `jwtVerify` menghitung ulang tanda tangan dari header dan payload, lalu membandingkannya
 * dengan tanda tangan di token. Ia juga menolak token yang `exp`-nya sudah lewat.
 */
export class JoseTokenVerifier implements TokenVerifier {
  readonly #key: Uint8Array;

  constructor(options: { secret: string }) {
    this.#key = new TextEncoder().encode(options.secret);
  }

  async verify(token: string): Promise<AuthContext> {
    try {
      // `algorithms` dikunci ke HS256 supaya token yang mengaku memakai algoritma lain
      // (misalnya "none", tanpa tanda tangan) langsung ditolak.
      const { payload } = await jwtVerify(token, this.#key, { algorithms: ["HS256"] });
      if (typeof payload.sub !== "string" || payload.sub === "") throw new Error("Token tanpa sub");
      return { userId: payload.sub };
    } catch {
      throw new UnauthorizedError(INVALID_TOKEN_MESSAGE);
    }
  }
}
