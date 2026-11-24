import { UnauthorizedError } from "../../../shared/domain/errors.ts";
import type { UserRepository } from "../domain/user-repository.ts";
import type { User } from "../domain/user.ts";

/**
 * Use case: mengganti nama user yang sedang login (`PATCH /auth/me`), dari langkah "Nama tampilan" di
 * onboarding. Bentuk dan panjang nama sudah dicek schema zod di presentation (aturan sama dengan register).
 */
export class UpdateProfile {
  readonly #users: UserRepository;

  constructor(users: UserRepository) {
    this.#users = users;
  }

  async execute(userId: string, changes: { name: string }): Promise<User> {
    const user = await this.#users.updateName(userId, changes.name);
    // Token-nya valid tapi akunnya sudah tidak ada. Diperlakukan sama seperti GET /auth/me.
    if (!user) throw new UnauthorizedError("Sesi kamu sudah habis. Silakan masuk lagi.");
    return user;
  }
}
