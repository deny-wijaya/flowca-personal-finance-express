import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "../../../shared/domain/errors.ts";
import { InMemoryAccountRepository } from "../infrastructure/in-memory-account-repository.ts";
import { InMemoryCategoryRepository } from "../infrastructure/in-memory-category-repository.ts";
import { CreateAccount } from "./create-account.ts";
import { ListAccounts } from "./list-accounts.ts";
import { InMemoryTransactionRepository } from "../infrastructure/in-memory-transaction-repository.ts";
import { CreateCategory } from "./create-category.ts";
import { ListCategories } from "./list-categories.ts";
import type { Clock } from "./clock.ts";
import { CreateTransaction } from "./create-transaction.ts";
import { DeleteTransaction } from "./delete-transaction.ts";
import { GetSummary } from "./get-summary.ts";
import { GetTransaction } from "./get-transaction.ts";
import { ListTransactions } from "./list-transactions.ts";
import { UpdateTransaction } from "./update-transaction.ts";

const fixedClock: Clock = { now: () => new Date("2026-11-14T10:00:00+07:00") };
const RANI = "usr_rani";
const BUDI = "usr_budi";

describe("transaction use cases", () => {
  let categories: InMemoryCategoryRepository;
  let accounts: InMemoryAccountRepository;
  let repository: InMemoryTransactionRepository;
  let create: CreateTransaction;
  let update: UpdateTransaction;

  beforeEach(() => {
    categories = new InMemoryCategoryRepository();
    // Saldo akun dihitung dari transaksi di `repository`, sebagai pengganti LEFT JOIN + SUM di Postgres.
    accounts = new InMemoryAccountRepository(() => repository.ledger(), [
      { id: "acc_rani", userId: RANI, name: "BCA", kind: "bank", openingBalance: 2_000_000, createdAt: new Date("2026-11-01T00:00:00Z") },
      { id: "acc_budi", userId: BUDI, name: "Tunai", kind: "cash", openingBalance: 0, createdAt: new Date("2026-11-01T00:00:00Z") },
    ]);
    repository = new InMemoryTransactionRepository([], categories, accounts);
    create = new CreateTransaction(repository, categories, accounts, fixedClock);
    update = new UpdateTransaction(repository, categories, accounts, fixedClock);
  });

  const makanSiang = {
    type: "expense" as const,
    amount: 85_000,
    categoryId: "cat_expense_makanan",
    accountId: "acc_rani",
    note: "Makan siang tim",
    occurredAt: new Date("2026-11-06T12:00:00+07:00"),
  };

  it("CreateTransaction menyimpan transaksi valid dan mengisi id", async () => {
    const created = await create.execute(RANI, makanSiang);
    expect(created.id).toMatch(/^trx_/);
    expect(await repository.findById(RANI, created.id)).toEqual(created);
    expect(created.userId).toBe(RANI);
    expect(created.category).toBe("Makanan");
  });

  it("CreateTransaction menolak kategori yang tidak ada dan kategori yang jenisnya tidak cocok", async () => {
    await expect(create.execute(RANI, { ...makanSiang, categoryId: "cat_tidak_ada" })).rejects.toThrow("Kategori tidak ditemukan");
    await expect(create.execute(RANI, { ...makanSiang, categoryId: "cat_income_gaji" })).rejects.toThrow(
      "Kategori Gaji tidak bisa dipakai untuk pengeluaran",
    );
  });

  it("CreateTransaction menerima kategori kustom milik sendiri, tapi menolak milik user lain", async () => {
    const kos = await new CreateCategory(categories).execute(BUDI, { name: "Kos", type: "expense" });
    await expect(create.execute(RANI, { ...makanSiang, categoryId: kos.id })).rejects.toThrow("Kategori tidak ditemukan");
    const created = await create.execute(BUDI, { ...makanSiang, categoryId: kos.id, accountId: "acc_budi" });
    expect(created.category).toBe("Kos");
  });

  it("CreateTransaction menolak transaksi bertanggal besok", async () => {
    await expect(create.execute(RANI, { ...makanSiang, occurredAt: new Date("2026-11-15T09:00:00+07:00") })).rejects.toThrow(
      ValidationError,
    );
  });

  it("ListTransactions mengurutkan dari tanggal terbaru dan memfilter type", async () => {
    await create.execute(RANI, { ...makanSiang, occurredAt: new Date("2026-11-02T09:00:00+07:00") });
    await create.execute(RANI, { ...makanSiang, occurredAt: new Date("2026-11-09T09:00:00+07:00") });
    await create.execute(RANI, { type: "income", amount: 12_500_000, categoryId: "cat_income_gaji", accountId: "acc_rani", note: null, occurredAt: new Date("2026-11-01T09:00:00+07:00") });

    const expenses = await new ListTransactions(repository).execute(RANI, { type: "expense" });
    expect(expenses.items.map((t) => t.occurredAt.getDate())).toEqual([9, 2]);
    expect(expenses.nextCursor).toBeNull();
  });

  it("ListTransactions membagi hasil per halaman dan cursor melanjutkan tanpa dobel atau terlewat", async () => {
    // Tiga transaksi di jam yang sama: urutannya ditentukan id, jadi cursor wajib menyimpan id juga.
    for (const note of ["A", "B", "C", "D", "E"]) {
      await create.execute(RANI, { ...makanSiang, note, occurredAt: new Date(`2026-11-0${note === "E" ? 1 : 6}T12:00:00+07:00`) });
    }
    const list = new ListTransactions(repository);

    const first = await list.execute(RANI, {}, { limit: 2 });
    const second = await list.execute(RANI, {}, { limit: 2, after: first.nextCursor! });
    const third = await list.execute(RANI, {}, { limit: 2, after: second.nextCursor! });

    const notes = [...first.items, ...second.items, ...third.items].map((t) => t.note);
    expect(notes).toHaveLength(5);
    expect(new Set(notes).size).toBe(5);
    expect(notes.at(-1)).toBe("E");
    expect(third.nextCursor).toBeNull();
  });

  it("UpdateTransaction menolak ganti type tanpa ganti kategori", async () => {
    const created = await create.execute(RANI, makanSiang);
    await expect(update.execute(RANI, created.id, { type: "income" })).rejects.toThrow(ValidationError);
    const moved = await update.execute(RANI, created.id, { type: "income", categoryId: "cat_income_bonus" });
    expect(moved.category).toBe("Bonus");
  });

  it("UpdateTransaction mengubah nominal", async () => {
    const created = await create.execute(RANI, makanSiang);
    const updated = await update.execute(RANI, created.id, { amount: 90_000 });
    expect(updated.amount).toBe(90_000);
    expect(updated.category).toBe("Makanan");
  });

  it("DeleteTransaction melempar NotFoundError untuk id yang tidak ada", async () => {
    await expect(new DeleteTransaction(repository).execute(RANI, "trx_tidak_ada")).rejects.toThrow(NotFoundError);
  });

  describe("transaksi milik user lain", () => {
    it("tidak muncul di daftar milik Rani", async () => {
      await create.execute(BUDI, { ...makanSiang, accountId: "acc_budi" });
      expect(await new ListTransactions(repository).execute(RANI)).toEqual({ items: [], nextCursor: null });
    });

    it("dianggap tidak ada saat dibuka, diubah, atau dihapus Rani (NotFoundError)", async () => {
      const milikBudi = await create.execute(BUDI, { ...makanSiang, accountId: "acc_budi" });

      await expect(new GetTransaction(repository).execute(RANI, milikBudi.id)).rejects.toThrow(NotFoundError);
      await expect(
        update.execute(RANI, milikBudi.id, { amount: 1 }),
      ).rejects.toThrow(NotFoundError);
      await expect(new DeleteTransaction(repository).execute(RANI, milikBudi.id)).rejects.toThrow(NotFoundError);

      // Transaksi Budi tetap utuh.
      expect(await repository.findById(BUDI, milikBudi.id)).toEqual(milikBudi);
    });
  });

  describe("GetSummary", () => {
    const november = { from: new Date("2026-11-01T00:00:00+07:00"), to: new Date("2026-11-30T23:59:59.999+07:00") };
    const gaji = { type: "income" as const, amount: 12_500_000, categoryId: "cat_income_gaji", accountId: "acc_rani", note: null, occurredAt: new Date("2026-11-01T09:00:00+07:00") };
    const kos = { type: "expense" as const, amount: 1_850_000, categoryId: "cat_expense_tagihan", accountId: "acc_rani", note: "Cicilan kos", occurredAt: new Date("2026-11-02T09:00:00+07:00") };

    it("menjumlahkan pemasukan, pengeluaran, arus kas, dan pengeluaran per kategori", async () => {
      await create.execute(RANI, gaji);
      await create.execute(RANI, kos);
      await create.execute(RANI, makanSiang);
      await create.execute(RANI, { ...makanSiang, amount: 15_000, note: "Es teh" });

      const summary = await new GetSummary(repository).execute(RANI, november);

      expect(summary).toEqual({
        totalIncome: 12_500_000,
        totalExpense: 1_950_000,
        netCashflow: 10_550_000,
        transactionCount: 4,
        incomeCount: 1,
        expenseCount: 3,
        expenseByCategory: [
          { categoryId: "cat_expense_tagihan", category: "Tagihan", amount: 1_850_000 },
          { categoryId: "cat_expense_makanan", category: "Makanan", amount: 100_000 },
        ],
      });
    });

    it("hanya menghitung transaksi milik user itu dan di dalam periode", async () => {
      await create.execute(RANI, { ...kos, occurredAt: new Date("2026-10-31T23:59:00+07:00") });
      await create.execute(BUDI, { ...kos, accountId: "acc_budi" });

      const summary = await new GetSummary(repository).execute(RANI, november);

      expect(summary).toEqual({ totalIncome: 0, totalExpense: 0, netCashflow: 0, transactionCount: 0, incomeCount: 0, expenseCount: 0, expenseByCategory: [] });
    });

    it("arus kas bersih bisa negatif", async () => {
      await create.execute(RANI, kos);
      const summary = await new GetSummary(repository).execute(RANI, november);
      expect(summary.netCashflow).toBe(-1_850_000);
    });
  });

  describe("kategori", () => {
    it("ListCategories mengembalikan 14 kategori bawaan berurutan, lalu kategori kustom milik sendiri", async () => {
      await new CreateCategory(categories).execute(RANI, { name: "Kos", type: "expense" });
      await new CreateCategory(categories).execute(BUDI, { name: "Hewan peliharaan", type: "expense" });

      const all = await new ListCategories(categories).execute(RANI, {}, { limit: 100 });
      expect(all.items).toHaveLength(15);
      expect(all.items[0]?.name).toBe("Makanan");
      expect(all.items.at(-1)?.name).toBe("Kos");

      const income = await new ListCategories(categories).execute(RANI, { type: "income" }, { limit: 100 });
      expect(income.items.map((c) => c.name)).toEqual(["Gaji", "Freelance", "Bonus", "Hadiah", "Investasi", "Lainnya"]);
    });

    it("ListCategories membagi per halaman dengan cursor", async () => {
      const list = new ListCategories(categories);
      const first = await list.execute(RANI, {}, { limit: 10 });
      const second = await list.execute(RANI, {}, { limit: 10, after: first.nextCursor! });
      expect(first.items).toHaveLength(10);
      expect(second.items).toHaveLength(4);
      expect(second.nextCursor).toBeNull();
    });

    it("CreateCategory merapikan nama dan menolak nama yang sudah ada untuk jenis yang sama", async () => {
      const createCategory = new CreateCategory(categories);
      const kos = await createCategory.execute(RANI, { name: "  Bayar   kos ", type: "expense" });
      expect(kos).toMatchObject({ name: "Bayar kos", type: "expense", userId: RANI });

      await expect(createCategory.execute(RANI, { name: "BAYAR KOS", type: "expense" })).rejects.toThrow("Kategori BAYAR KOS sudah ada");
      await expect(createCategory.execute(RANI, { name: "makanan", type: "expense" })).rejects.toThrow("Kategori makanan sudah ada");
      // Jenis lain atau user lain boleh memakai nama yang sama.
      await expect(createCategory.execute(RANI, { name: "Bayar kos", type: "income" })).resolves.toMatchObject({ type: "income" });
      await expect(createCategory.execute(BUDI, { name: "Bayar kos", type: "expense" })).resolves.toMatchObject({ userId: BUDI });
    });
  });

  describe("akun", () => {
    it("CreateTransaction menolak transaksi tanpa akun, akun yang tidak ada, dan akun milik user lain", async () => {
      await expect(create.execute(RANI, { ...makanSiang, accountId: null })).rejects.toThrow("Akun tidak ditemukan");
      await expect(create.execute(RANI, { ...makanSiang, accountId: "acc_tidak_ada" })).rejects.toThrow("Akun tidak ditemukan");
      await expect(create.execute(RANI, { ...makanSiang, accountId: "acc_budi" })).rejects.toThrow("Akun tidak ditemukan");
    });

    it("saldo akun = saldo awal + pemasukan − pengeluaran, dan ikut berubah saat transaksi dipindah akun", async () => {
      await create.execute(RANI, { ...makanSiang, type: "income", categoryId: "cat_income_gaji", amount: 12_500_000 });
      const kos = await create.execute(RANI, { ...makanSiang, amount: 1_500_000 });
      const balanceOf = async (id: string) => (await new ListAccounts(accounts).execute(RANI)).items.find((a) => a.id === id)?.balance;

      expect(await balanceOf("acc_rani")).toBe(13_000_000);

      const tunai = await new CreateAccount(accounts).execute(RANI, { name: "Tunai", kind: "cash", openingBalance: 500_000 });
      const moved = await update.execute(RANI, kos.id, { accountId: tunai.id });
      expect(moved.account).toBe("Tunai");
      expect(await balanceOf("acc_rani")).toBe(14_500_000);
      expect(await balanceOf(tunai.id)).toBe(-1_000_000);
    });

    it("UpdateTransaction tidak mewajibkan akun untuk transaksi lama tanpa akun, kecuali akunnya diganti", async () => {
      const lama = await repository.create(RANI, { ...makanSiang, accountId: null });
      expect((await update.execute(RANI, lama.id, { amount: 90_000 })).accountId).toBeNull();
      await expect(update.execute(RANI, lama.id, { accountId: "acc_budi" })).rejects.toThrow("Akun tidak ditemukan");
    });

    it("CreateAccount merapikan nama, menolak nama dobel tanpa beda huruf besar kecil, dan memvalidasi saldo awal", async () => {
      const createAccount = new CreateAccount(accounts);
      const gopay = await createAccount.execute(RANI, { name: "  Go   Pay ", kind: "ewallet", openingBalance: -50_000 });
      expect(gopay).toMatchObject({ name: "Go Pay", balance: -50_000 });

      await expect(createAccount.execute(RANI, { name: "bca", kind: "bank", openingBalance: 0 })).rejects.toThrow("Akun bca sudah ada");
      await expect(createAccount.execute(BUDI, { name: "BCA", kind: "bank", openingBalance: 0 })).resolves.toMatchObject({ userId: BUDI });
      await expect(createAccount.execute(RANI, { name: " ", kind: "cash", openingBalance: 0 })).rejects.toThrow("Nama akun wajib diisi");
      await expect(createAccount.execute(RANI, { name: "Dompet", kind: "cash", openingBalance: 1.5 })).rejects.toThrow("Saldo awal harus bilangan bulat");
    });

    it("ListAccounts hanya berisi akun milik sendiri, urut dari yang paling lama", async () => {
      await new CreateAccount(accounts).execute(RANI, { name: "Tunai", kind: "cash", openingBalance: 0 });
      const page = await new ListAccounts(accounts).execute(RANI);
      expect(page.items.map((a) => a.name)).toEqual(["BCA", "Tunai"]);
    });
  });
});
