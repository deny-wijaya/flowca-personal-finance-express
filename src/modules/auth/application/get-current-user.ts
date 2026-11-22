import { UnauthorizedError } from "../../../shared/domain/errors.ts";
import type { UserRepository } from "../domain/user-repository.ts";
import type { User } from "../domain/user.ts";

/** Use case: profil user yang sedang login (kartu profil di frontend, `GET /auth/me`). */
export class GetCurrentUser {
  readonly #users: UserRepository;

  constructor(users: UserRepository) {
    this.#users = users;
  }

  async execute(userId: string): Promise<User> {
    const user = await this.#users.findById(userId);
    // Token-nya valid tapi akunnya sudah tidak ada. Diperlakukan sama seperti sesi yang habis.
    if (!user) throw new UnauthorizedError("Sesi kamu sudah habis. Silakan masuk lagi.");
    return user;
  }
}
