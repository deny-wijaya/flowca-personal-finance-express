import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../../../shared/database/database.ts";
import { users } from "../../auth/infrastructure/user.table.ts";
import type { NewTransaction } from "../domain/transaction.ts";
import { PostgresTransactionRepository } from "./postgres-transaction-repository.ts";
import { transactions } from "./transaction.table.ts";

/**
 * Test repository ke database Postgres sungguhan (personal_finance_test, bukan personal_finance,
 * karena setiap test menghapus isi tabel). Jalankan dengan `npm run test:db`.
 * Tanpa TEST_DATABASE_URL, seluruh file ini di-skip sehingga `npm test` tetap lolos tanpa Docker.
 * Kolom user_id punya foreign key ke users.id, jadi dua user uji (Rani dan Budi) dibuat dulu.
 */
const RANI = "usr_test_rani";
const BUDI = "usr_test_budi";
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("PostgresTransactionRepository", () => {
  // `url!` aman karena describe ini di-skip ketika url kosong.
  const { db, close } = createDatabase(url!);
  const repository = new PostgresTransactionRepository(db);

  const gaji: NewTransaction = {
    type: "income",
    amount: 12_500_000,
    category: "Gaji",
    note: "Gaji bulanan",
    occurredAt: new Date("2026-11-01T09:00:00+07:00"),
  };
  const gojek: NewTransaction = {
    type: "expense",
    amount: 64_000,
    category: "Transportasi",
    note: "Gojek ke kantor",
    occurredAt: new Date("2026-11-06T09:00:00+07:00"),
  };

  beforeEach(async () => {
    await db.delete(transactions);
    await db
      .insert(users)
      .values([
        { id: RANI, name: "Rani Putri", email: "rani.repo@email.com", passwordHash: "hash" },
        { id: BUDI, name: "Budi Santoso", email: "budi.repo@email.com", passwordHash: "hash" },
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    // Tanpa ini Vitest menunggu pool yang masih terbuka dan tidak pernah selesai.
    await close();
  });

  it("create lalu findById mengembalikan data yang sama", async () => {
    const created = await repository.create(RANI, gojek);
    expect(created.id).toMatch(/^trx_/);
    expect(created).toMatchObject(gojek);
    expect(created.createdAt).toBeInstanceOf(Date);

    expect(await repository.findById(RANI, created.id)).toEqual(created);
  });

  it("findById mengembalikan null untuk id yang tidak ada", async () => {
    expect(await repository.findById(RANI, "trx_tidak_ada")).toBeNull();
  });

  it("amount bigint kembali sebagai number, termasuk nominal Rp900 miliar", async () => {
    const created = await repository.create(RANI, { ...gaji, amount: 900_000_000_000 });
    const found = await repository.findById(RANI, created.id);
    expect(found?.amount).toBe(900_000_000_000);
    expect(typeof found?.amount).toBe("number");
  });

  it("note boleh null", async () => {
    const created = await repository.create(RANI, { ...gojek, note: null });
    expect((await repository.findById(RANI, created.id))?.note).toBeNull();
  });

  it("list memfilter type dan urut dari occurredAt terbaru", async () => {
    await repository.create(RANI, gaji);
    await repository.create(RANI, gojek);
    await repository.create(RANI, { ...gaji, category: "Freelance", occurredAt: new Date("2026-11-08T09:00:00+07:00") });

    const all = await repository.list(RANI);
    expect(all.map((trx) => trx.category)).toEqual(["Freelance", "Transportasi", "Gaji"]);

    const income = await repository.list(RANI, { type: "income" });
    expect(income.map((trx) => trx.category)).toEqual(["Freelance", "Gaji"]);
  });

  it("list memfilter rentang from dan to (inklusif)", async () => {
    await repository.create(RANI, gaji);
    await repository.create(RANI, gojek);

    const result = await repository.list(RANI, {
      from: new Date("2026-11-06T09:00:00+07:00"),
      to: new Date("2026-11-30T23:59:59+07:00"),
    });
    expect(result.map((trx) => trx.note)).toEqual(["Gojek ke kantor"]);
  });

  it("update mengubah nominal dan memajukan updatedAt", async () => {
    const created = await repository.create(RANI, gojek);
    const updated = await repository.update(RANI, created.id, { ...gojek, amount: 70_000 });

    expect(updated.amount).toBe(70_000);
    expect(updated.createdAt).toEqual(created.createdAt);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.createdAt.getTime());
  });

  it("update id yang tidak ada melempar error", async () => {
    await expect(repository.update(RANI, "trx_tidak_ada", gojek)).rejects.toThrow();
  });

  it("delete membuat findById mengembalikan null", async () => {
    const created = await repository.create(RANI, gojek);
    await repository.delete(RANI, created.id);
    expect(await repository.findById(RANI, created.id)).toBeNull();
  });

  it("transaksi milik Budi tidak terbaca, tidak bisa diubah, dan tidak bisa dihapus oleh Rani", async () => {
    const milikBudi = await repository.create(BUDI, gojek);

    expect(await repository.list(RANI)).toEqual([]);
    expect(await repository.findById(RANI, milikBudi.id)).toBeNull();
    await expect(repository.update(RANI, milikBudi.id, { ...gojek, amount: 1 })).rejects.toThrow();
    await repository.delete(RANI, milikBudi.id);

    // Data Budi tetap utuh.
    expect(await repository.findById(BUDI, milikBudi.id)).toEqual(milikBudi);
  });

  it("foreign key menolak transaksi untuk user yang tidak ada", async () => {
    await expect(repository.create("usr_tidak_ada", gojek)).rejects.toThrow();
  });
});
