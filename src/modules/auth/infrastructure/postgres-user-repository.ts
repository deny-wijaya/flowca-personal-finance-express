import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "../../../shared/database/database.ts";
import type { UserRepository } from "../domain/user-repository.ts";
import { EmailAlreadyRegisteredError, type NewUser, type User } from "../domain/user.ts";
import { users } from "./user.table.ts";

/** Kode error Postgres untuk pelanggaran unique constraint. */
const UNIQUE_VIOLATION = "23505";

export class PostgresUserRepository implements UserRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.#db.select().from(users).where(eq(users.email, email));
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
}

/** Drizzle membungkus error dari driver pg, jadi kode aslinya bisa ada di `error.cause`. */
function isUniqueViolation(error: unknown): boolean {
  const codeOf = (value: unknown) =>
    typeof value === "object" && value !== null && "code" in value ? value.code : undefined;
  const cause = typeof error === "object" && error !== null && "cause" in error ? error.cause : undefined;
  return codeOf(error) === UNIQUE_VIOLATION || codeOf(cause) === UNIQUE_VIOLATION;
}
