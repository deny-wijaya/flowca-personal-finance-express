import { randomUUID } from "node:crypto";
import type { UserRepository } from "../domain/user-repository.ts";
import { EmailAlreadyRegisteredError, type NewUser, type User } from "../domain/user.ts";

/** Repository user di memori. Dipakai oleh unit test dan test HTTP supaya tidak butuh Docker. */
export class InMemoryUserRepository implements UserRepository {
  readonly #rows = new Map<string, User>();

  async findByEmail(email: string): Promise<User | null> {
    return [...this.#rows.values()].find((user) => user.email === email) ?? null;
  }

  async create(input: NewUser): Promise<User> {
    // Meniru unique constraint di Postgres.
    if (await this.findByEmail(input.email)) throw new EmailAlreadyRegisteredError();
    const user: User = { ...input, id: `usr_${randomUUID()}`, createdAt: new Date() };
    this.#rows.set(user.id, user);
    return user;
  }
}
