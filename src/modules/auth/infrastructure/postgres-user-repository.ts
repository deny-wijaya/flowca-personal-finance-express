import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "../../../shared/database/database.ts";
import type { UserRepository } from "../domain/user-repository.ts";
import { EmailAlreadyRegisteredError, type NewUser, type User } from "../domain/user.ts";
import { users } from "./user.table.ts";
import { isUniqueViolation } from "../../../shared/database/errors.ts";

export class PostgresUserRepository implements UserRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.#db.select().from(users).where(eq(users.email, email));
    return row ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.#db.select().from(users).where(eq(users.id, id));
    return row ?? null;
  }

  async create(input: NewUser): Promise<User> {
    try {
      const [row] = await this.#db
        .insert(users)
        .values({ ...input, id: `usr_${randomUUID()}` })
        .returning();
      if (!row) throw new Error("Insert user tidak mengembalikan baris");
      return row;
    } catch (error) {
      // Dua request register dengan email sama bisa sama-sama lolos cek findByEmail di use case.
      // Yang kedua akan ditolak Postgres di sini, lalu kita ubah menjadi error domain (409).
      if (isUniqueViolation(error)) throw new EmailAlreadyRegisteredError();
      throw error;
    }
  }

  async updateName(id: string, name: string): Promise<User | null> {
    // returning() mengembalikan baris setelah diubah; array kosong kalau id tidak ditemukan.
    const [row] = await this.#db.update(users).set({ name }).where(eq(users.id, id)).returning();
    return row ?? null;
  }
}
