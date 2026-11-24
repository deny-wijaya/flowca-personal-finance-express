import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../../../shared/database/database.ts";
import { users } from "../../auth/infrastructure/user.table.ts";
import type { NewTransaction } from "../domain/transaction.ts";
import { PostgresTransactionRepository } from "./postgres-transaction-repository.ts";
import { accounts, budgets, categories, transactions } from "./transaction.table.ts";
import { PostgresBudgetRepository } from "./postgres-budget-repository.ts";
import { PostgresAccountRepository } from "./postgres-account-repository.ts";
import { AccountAlreadyExistsError } from "../domain/account.ts";
import { PostgresCategoryRepository } from "./postgres-category-repository.ts";
import { CategoryAlreadyExistsError } from "../domain/category.ts";
import { isNotNull, eq } from "drizzle-orm";

/**
 * Test repository ke database Postgres sungguhan (personal_finance_test, bukan personal_finance,
 * karena setiap test menghapus isi tabel). Jalankan dengan `npm run test:db`.
 * Tanpa TEST_DATABASE_URL, seluruh file ini di-skip sehingga `npm test` tetap lolos tanpa Docker.
 * Kolom user_id punya foreign key ke users.id, jadi dua user uji (Rani dan Budi) dibuat dulu.
 */
const RANI = "usr_test_rani";
const firstPage = { limit: 20 };
const BUDI = "usr_test_budi";
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("PostgresTransactionRepository", () => {
  // `url!` aman karena describe ini di-skip ketika url kosong.
  const { db, close } = createDatabase(url!);
  const repository = new PostgresTransactionRepository(db);
  const categoryRepository = new PostgresCategoryRepository(db);
  const accountRepository = new PostgresAccountRepository(db);
  const budgetRepository = new PostgresBudgetRepository(db);

  const gaji: NewTransaction = {
    type: "income",
    amount: 12_500_000,
    categoryId: "cat_income_gaji",
    accountId: null,
    note: "Gaji bulanan",
    occurredAt: new Date("2026-11-01T09:00:00+07:00"),
  };
  const gojek: NewTransaction = {
    type: "expense",
    amount: 64_000,
    categoryId: "cat_expense_transportasi",
    accountId: null,
    note: "Gojek ke kantor",
    occurredAt: new Date("2026-11-06T09:00:00+07:00"),
  };

  beforeEach(async () => {
    await db.delete(transactions);
    await db.delete(accounts);
    await db.delete(budgets);
    // Kategori bawaan (dari migration) tetap ada; hanya kategori kustom dari test sebelumnya yang dihapus.
    await db.delete(categories).where(isNotNull(categories.userId));
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
    await repository.create(RANI, { ...gaji, categoryId: "cat_income_freelance", occurredAt: new Date("2026-11-08T09:00:00+07:00") });

    const all = await repository.list(RANI, {}, firstPage);
    expect(all.items.map((trx) => trx.category)).toEqual(["Freelance", "Transportasi", "Gaji"]);

    const income = await repository.list(RANI, { type: "income" }, firstPage);
    expect(income.items.map((trx) => trx.category)).toEqual(["Freelance", "Gaji"]);
  });

  it("list memfilter rentang from dan to (inklusif)", async () => {
    await repository.create(RANI, gaji);
    await repository.create(RANI, gojek);

    const result = await repository.list(
      RANI,
      { from: new Date("2026-11-06T09:00:00+07:00"), to: new Date("2026-11-30T23:59:59+07:00") },
      firstPage,
    );
    expect(result.items.map((trx) => trx.note)).toEqual(["Gojek ke kantor"]);
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

    expect(await repository.list(RANI, {}, firstPage)).toEqual({ items: [], nextCursor: null });
    expect(await repository.findById(RANI, milikBudi.id)).toBeNull();
    await expect(repository.update(RANI, milikBudi.id, { ...gojek, amount: 1 })).rejects.toThrow();
    await repository.delete(RANI, milikBudi.id);

    // Data Budi tetap utuh.
    expect(await repository.findById(BUDI, milikBudi.id)).toEqual(milikBudi);
  });

  it("foreign key menolak transaksi untuk user yang tidak ada", async () => {
    await expect(repository.create("usr_tidak_ada", gojek)).rejects.toThrow();
  });

  it("summarize menjumlahkan dengan SUM dan GROUP BY, hanya milik user itu di dalam periode", async () => {
    const november = { from: new Date("2026-11-01T00:00:00+07:00"), to: new Date("2026-11-30T23:59:59.999+07:00") };
    await repository.create(RANI, gaji);
    await repository.create(RANI, gojek);
    await repository.create(RANI, { ...gojek, amount: 900_000_000_000, categoryId: "cat_expense_tagihan", note: "Nominal besar" });
    await repository.create(RANI, { ...gojek, occurredAt: new Date("2026-10-31T23:00:00+07:00") });
    await repository.create(BUDI, gojek);

    expect(await repository.summarize(RANI, november)).toEqual({
      totalIncome: 12_500_000,
      totalExpense: 900_000_064_000,
      transactionCount: 3,
      incomeCount: 1,
      expenseCount: 2,
      expenseByCategory: [
        { categoryId: "cat_expense_tagihan", category: "Tagihan", amount: 900_000_000_000 },
        { categoryId: "cat_expense_transportasi", category: "Transportasi", amount: 64_000 },
      ],
    });
  });

  it("summarize mengembalikan 0 dan array kosong kalau tidak ada transaksi", async () => {
    const range = { from: new Date("2026-11-01T00:00:00+07:00"), to: new Date("2026-11-30T23:59:59.999+07:00") };
    expect(await repository.summarize(RANI, range)).toEqual({
      totalIncome: 0,
      totalExpense: 0,
      transactionCount: 0,
      incomeCount: 0,
      expenseCount: 0,
      expenseByCategory: [],
    });
  });

  it("list keyset: halaman berikutnya mulai tepat sesudah cursor, termasuk untuk occurred_at yang sama", async () => {
    // 5 transaksi di jam yang sama: urutan di antara mereka ditentukan oleh id.
    for (let i = 0; i < 5; i++) await repository.create(RANI, { ...gojek, note: `Gojek ${i}` });
    await repository.create(RANI, gaji);

    const seen: string[] = [];
    let page = await repository.list(RANI, {}, { limit: 4 });
    seen.push(...page.items.map((trx) => trx.id));
    expect(page.nextCursor).not.toBeNull();
    page = await repository.list(RANI, {}, { limit: 4, after: page.nextCursor! });
    seen.push(...page.items.map((trx) => trx.id));

    expect(page.nextCursor).toBeNull();
    expect(seen).toHaveLength(6);
    expect(new Set(seen).size).toBe(6);
    const all = await repository.list(RANI, {}, { limit: 100 });
    expect(seen).toEqual(all.items.map((trx) => trx.id));
    expect(all.items.at(-1)?.category).toBe("Gaji");
  });

  it("list memfilter category_id dan q (ILIKE di note dan nama kategori), dengan % diperlakukan sebagai teks", async () => {
    await repository.create(RANI, gojek);
    await repository.create(RANI, gaji);
    await repository.create(RANI, { ...gojek, categoryId: "cat_expense_belanja", note: "Diskon 50% Superindo" });

    const byCategory = await repository.list(RANI, { categoryId: "cat_expense_transportasi" }, firstPage);
    expect(byCategory.items.map((trx) => trx.note)).toEqual(["Gojek ke kantor"]);

    const byNote = await repository.list(RANI, { q: "GOJEK" }, firstPage);
    expect(byNote.items.map((trx) => trx.note)).toEqual(["Gojek ke kantor"]);

    const byCategoryText = await repository.list(RANI, { q: "gaj" }, firstPage);
    expect(byCategoryText.items.map((trx) => trx.category)).toEqual(["Gaji"]);

    const percent = await repository.list(RANI, { q: "0%" }, firstPage);
    expect(percent.items.map((trx) => trx.category)).toEqual(["Belanja"]);
  });

  it("migration mengisi 14 kategori bawaan, dan list kategori memakai keyset pagination", async () => {
    const first = await categoryRepository.list(RANI, {}, { limit: 10 });
    const second = await categoryRepository.list(RANI, {}, { limit: 10, after: first.nextCursor! });
    expect([...first.items, ...second.items].map((c) => c.id).slice(0, 2)).toEqual(["cat_expense_makanan", "cat_expense_transportasi"]);
    expect(first.items.length + second.items.length).toBe(14);
    expect(second.nextCursor).toBeNull();

    const income = await categoryRepository.list(RANI, { type: "income" }, { limit: 100 });
    expect(income.items.map((c) => c.name)).toEqual(["Gaji", "Freelance", "Bonus", "Hadiah", "Investasi", "Lainnya"]);
  });

  it("kategori kustom hanya terlihat oleh pemiliknya, dan nama dobel ditolak (termasuk nama bawaan)", async () => {
    const kos = await categoryRepository.create(RANI, { name: "Kos", type: "expense" });
    expect(kos.id).toMatch(/^cat_/);

    expect(await categoryRepository.findById(RANI, kos.id)).toEqual(kos);
    expect(await categoryRepository.findById(BUDI, kos.id)).toBeNull();
    expect((await categoryRepository.list(BUDI, { type: "expense" }, { limit: 100 })).items).toHaveLength(8);

    await expect(categoryRepository.create(RANI, { name: "KOS", type: "expense" })).rejects.toBeInstanceOf(CategoryAlreadyExistsError);
    await expect(categoryRepository.create(RANI, { name: "transportasi", type: "expense" })).rejects.toBeInstanceOf(CategoryAlreadyExistsError);
    await expect(categoryRepository.create(BUDI, { name: "Kos", type: "expense" })).resolves.toMatchObject({ userId: BUDI });
  });

  it("pagination kategori kustom tidak mengulang kategori yang menjadi cursor (created_at presisi milidetik)", async () => {
    for (const name of ["Kos", "Hewan", "Arisan"]) await categoryRepository.create(RANI, { name, type: "expense" });
    const seen: string[] = [];
    let page = await categoryRepository.list(RANI, { type: "expense" }, { limit: 9 });
    seen.push(...page.items.map((c) => c.name));
    page = await categoryRepository.list(RANI, { type: "expense" }, { limit: 9, after: page.nextCursor! });
    seen.push(...page.items.map((c) => c.name));
    const all = await categoryRepository.list(RANI, { type: "expense" }, { limit: 100 });
    expect(seen).toEqual(all.items.map((c) => c.name));
    expect(new Set(seen).size).toBe(11);
  });

  it("dua request bersamaan dengan nama sama: satu berhasil, satu ditolak unique index", async () => {
    const results = await Promise.allSettled([
      categoryRepository.create(RANI, { name: "Kos", type: "expense" }),
      categoryRepository.create(RANI, { name: "Kos", type: "expense" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(CategoryAlreadyExistsError);
  });

  it("transaksi membawa nama kategori kustom lewat JOIN, dan kategori yang masih dipakai tidak bisa dihapus", async () => {
    const kos = await categoryRepository.create(RANI, { name: "Kos", type: "expense" });
    const created = await repository.create(RANI, { ...gojek, categoryId: kos.id });
    expect(created).toMatchObject({ categoryId: kos.id, category: "Kos" });

    await expect(db.delete(categories).where(eq(categories.id, kos.id))).rejects.toThrow();
  });

  it("menghapus user ikut menghapus kategori kustom dan transaksinya sekaligus", async () => {
    const temp = "usr_test_hapus";
    await db.insert(users).values({ id: temp, name: "User Sementara", email: "hapus.repo@email.com", passwordHash: "hash" });
    const kos = await categoryRepository.create(temp, { name: "Kos", type: "expense" });
    await repository.create(temp, { ...gojek, categoryId: kos.id });

    await db.delete(users).where(eq(users.id, temp));

    expect(await categoryRepository.findById(temp, kos.id)).toBeNull();
  });

  describe("akun", () => {
    it("saldo dihitung dengan LEFT JOIN + SUM: saldo awal + pemasukan − pengeluaran, akun tanpa transaksi tetap muncul", async () => {
      const bca = await accountRepository.create(RANI, { name: "BCA", kind: "bank", openingBalance: 2_000_000 });
      const tunai = await accountRepository.create(RANI, { name: "Tunai", kind: "cash", openingBalance: 500_000 });
      await accountRepository.create(BUDI, { name: "Dompet Budi", kind: "cash", openingBalance: 9_000 });
      await repository.create(RANI, { ...gaji, accountId: bca.id });
      await repository.create(RANI, { ...gojek, amount: 1_500_000, accountId: bca.id });
      await repository.create(RANI, { ...gojek, amount: 900_000_000_000, accountId: bca.id });

      const page = await accountRepository.list(RANI, { limit: 20 });

      // Diurutkan per nama di sini, karena dua akun yang dibuat di milidetik yang sama urutannya ditentukan id acak.
      const rows = page.items.map((a) => [a.name, a.openingBalance, a.balance]).sort((x, y) => String(x[0]).localeCompare(String(y[0])));
      expect(rows).toEqual([
        ["BCA", 2_000_000, 2_000_000 + 12_500_000 - 1_500_000 - 900_000_000_000],
        ["Tunai", 500_000, 500_000],
      ]);
      expect(page.items.every((a) => typeof a.balance === "number")).toBe(true);
      expect(tunai.balance).toBe(500_000);
    });

    it("list akun memakai keyset pagination", async () => {
      for (const name of ["A", "B", "C"]) await accountRepository.create(RANI, { name, kind: "cash", openingBalance: 0 });
      const first = await accountRepository.list(RANI, { limit: 2 });
      const second = await accountRepository.list(RANI, { limit: 2, after: first.nextCursor! });
      // Akun yang dibuat di milidetik yang sama diurutkan berdasarkan id (acak), jadi yang dicek adalah
      // gabungan halaman sama persis dengan daftar lengkap: tidak ada yang dobel atau terlewat.
      const all = await accountRepository.list(RANI, { limit: 100 });
      expect([...first.items, ...second.items].map((a) => a.id)).toEqual(all.items.map((a) => a.id));
      expect(all.items).toHaveLength(3);
      expect(second.nextCursor).toBeNull();
    });

    it("nama akun unik per user tanpa beda huruf besar kecil, termasuk dua request bersamaan", async () => {
      await accountRepository.create(RANI, { name: "BCA", kind: "bank", openingBalance: 0 });
      await expect(accountRepository.create(RANI, { name: "bca", kind: "bank", openingBalance: 0 })).rejects.toBeInstanceOf(AccountAlreadyExistsError);
      await expect(accountRepository.create(BUDI, { name: "BCA", kind: "bank", openingBalance: 0 })).resolves.toMatchObject({ userId: BUDI });

      const results = await Promise.allSettled([
        accountRepository.create(RANI, { name: "GoPay", kind: "ewallet", openingBalance: 0 }),
        accountRepository.create(RANI, { name: "GoPay", kind: "ewallet", openingBalance: 0 }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    });

    it("akun milik user lain tidak terbaca, dan transaksi membawa nama akun lewat LEFT JOIN", async () => {
      const bca = await accountRepository.create(RANI, { name: "BCA", kind: "bank", openingBalance: 0 });
      expect(await accountRepository.findById(BUDI, bca.id)).toBeNull();

      const withAccount = await repository.create(RANI, { ...gojek, accountId: bca.id });
      const withoutAccount = await repository.create(RANI, gaji);
      expect(withAccount).toMatchObject({ accountId: bca.id, account: "BCA" });
      expect(withoutAccount).toMatchObject({ accountId: null, account: null });

      const filtered = await repository.list(RANI, { accountId: bca.id }, firstPage);
      expect(filtered.items.map((t) => t.id)).toEqual([withAccount.id]);
    });

    it("akun yang masih dipakai transaksi tidak bisa dihapus, tapi menghapus user ikut menghapus akun dan transaksinya", async () => {
      const temp = "usr_test_hapus_akun";
      await db.insert(users).values({ id: temp, name: "User Sementara", email: "hapus.akun@email.com", passwordHash: "hash" });
      const dompet = await accountRepository.create(temp, { name: "Dompet", kind: "cash", openingBalance: 0 });
      await repository.create(temp, { ...gojek, accountId: dompet.id });

      await expect(db.delete(accounts).where(eq(accounts.id, dompet.id))).rejects.toThrow();
      await db.delete(users).where(eq(users.id, temp));
      expect(await accountRepository.findById(temp, dompet.id)).toBeNull();
    });
  });

  describe("anggaran", () => {
    it("upsert memakai ON CONFLICT: dua kali PUT tetap satu baris dengan nominal terakhir", async () => {
      await budgetRepository.upsert(RANI, "cat_expense_makanan", 1_500_000);
      const updated = await budgetRepository.upsert(RANI, "cat_expense_makanan", 2_000_000);
      expect(updated).toMatchObject({ categoryId: "cat_expense_makanan", category: "Makanan", amount: 2_000_000 });

      const page = await budgetRepository.list(RANI, { limit: 20 });
      expect(page.items.map((b) => [b.categoryId, b.amount])).toEqual([["cat_expense_makanan", 2_000_000]]);
      expect((await budgetRepository.list(BUDI, { limit: 20 })).items).toEqual([]);
    });

    it("dua upsert bersamaan untuk kategori yang sama tidak membuat baris dobel", async () => {
      await Promise.all([
        budgetRepository.upsert(RANI, "cat_expense_tagihan", 100_000),
        budgetRepository.upsert(RANI, "cat_expense_tagihan", 200_000),
      ]);
      expect((await budgetRepository.list(RANI, { limit: 20 })).items).toHaveLength(1);
    });

    it("list anggaran memakai keyset pagination tanpa item dobel", async () => {
      for (const id of ["cat_expense_makanan", "cat_expense_belanja", "cat_expense_hiburan"]) await budgetRepository.upsert(RANI, id, 100_000);
      const first = await budgetRepository.list(RANI, { limit: 2 });
      const second = await budgetRepository.list(RANI, { limit: 2, after: first.nextCursor! });
      const all = await budgetRepository.list(RANI, { limit: 100 });
      expect([...first.items, ...second.items].map((b) => b.categoryId)).toEqual(all.items.map((b) => b.categoryId));
      expect(all.items).toHaveLength(3);
    });

    it("delete mengembalikan true sekali, lalu false; menghapus kategori kustom ikut menghapus anggarannya", async () => {
      await budgetRepository.upsert(RANI, "cat_expense_hiburan", 300_000);
      expect(await budgetRepository.delete(RANI, "cat_expense_hiburan")).toBe(true);
      expect(await budgetRepository.delete(RANI, "cat_expense_hiburan")).toBe(false);

      const kos = await categoryRepository.create(RANI, { name: "Kos", type: "expense" });
      await budgetRepository.upsert(RANI, kos.id, 1_500_000);
      await db.delete(categories).where(eq(categories.id, kos.id));
      expect((await budgetRepository.list(RANI, { limit: 20 })).items).toEqual([]);
    });
  });
});
