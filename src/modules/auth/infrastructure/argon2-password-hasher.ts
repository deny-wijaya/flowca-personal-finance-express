import argon2 from "argon2";
import type { PasswordHasher } from "../domain/password-hasher.ts";

/**
 * Hash password dengan argon2id, pilihan pertama OWASP untuk menyimpan password.
 * argon2 sengaja lambat dan memakai banyak memori, sehingga menebak password
 * dari hash yang bocor menjadi sangat mahal. Salt acak dan parameternya ikut tersimpan
 * di dalam string hash (`$argon2id$v=19$m=65536,t=3,p=4$...`), jadi tidak perlu kolom terpisah.
 */
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
