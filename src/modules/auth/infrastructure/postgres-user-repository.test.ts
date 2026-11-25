import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../../../shared/database/database.ts";
import { EmailAlreadyRegisteredError, type NewUser } from "../domain/user.ts";
import { PostgresUserRepository } from "./postgres-user-repository.ts";
import { users } from "./user.table.ts";

/**
 * Test repository user ke database personal_finance_test. Jalankan dengan `npm run test:db`.
 * Tanpa TEST_DATABASE_URL, file ini di-skip sehingga `npm test` tetap lolos tanpa Docker.
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("PostgresUserRepository", () => {
  const { db, close } = createDatabase(url!);
  const repository = new PostgresUserRepository(db);

  const rani: NewUser = {
    name: "Rani Putri",
    email: "rani@email.com",
    passwordHash: "$argon2id$contoh",
    termsAcceptedAt: new Date("2026-11-25T03:00:00.000Z"),
  };

  beforeEach(async () => {
    await db.delete(users);
  });

  afterAll(async () => {
    await close();
  });

  it("create lalu findByEmail mengembalikan user yang sama", async () => {
    const created = await repository.create(rani);
    expect(created.id).toMatch(/^usr_/);
    expect(created).toMatchObject(rani);
    expect(created.createdAt).toBeInstanceOf(Date);

    expect(await repository.findByEmail("rani@email.com")).toEqual(created);
  });

  it("findById mengembalikan user, atau null untuk id yang tidak ada", async () => {
    const created = await repository.create(rani);
    expect(await repository.findById(created.id)).toEqual(created);
    expect(await repository.findById("usr_tidak_ada")).toBeNull();
  });

  it("updateName mengganti nama dan mengembalikan user terbaru, atau null untuk id yang tidak ada", async () => {
    const created = await repository.create(rani);
    const updated = await repository.updateName(created.id, "Rani");
    expect(updated).toEqual({ ...created, name: "Rani" });
    expect(await repository.findById(created.id)).toEqual(updated);
    expect(await repository.updateName("usr_tidak_ada", "Siapa")).toBeNull();
  });

  it("findByEmail mengembalikan null untuk email yang tidak terdaftar", async () => {
    expect(await repository.findByEmail("tidak.ada@email.com")).toBeNull();
  });

  it("unique constraint menolak email kembar dengan EmailAlreadyRegisteredError", async () => {
    await repository.create(rani);
    await expect(repository.create({ ...rani, name: "Rani Kedua" })).rejects.toThrow(EmailAlreadyRegisteredError);
  });

  it("dua register bersamaan dengan email sama: hanya satu yang tersimpan", async () => {
    const results = await Promise.allSettled([repository.create(rani), repository.create(rani)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
});
