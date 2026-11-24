import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "../../../shared/domain/errors.ts";
import { InMemoryTransactionRepository } from "../infrastructure/in-memory-transaction-repository.ts";
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
  let repository: InMemoryTransactionRepository;
  let create: CreateTransaction;

  beforeEach(() => {
    repository = new InMemoryTransactionRepository();
    create = new CreateTransaction(repository, fixedClock);
  });

  const makanSiang = {
    type: "expense" as const,
    amount: 85_000,
    category: "Makan & Minum",
    note: "Makan siang tim",
    occurredAt: new Date("2026-11-06T12:00:00+07:00"),
  };

  it("CreateTransaction menyimpan transaksi valid dan mengisi id", async () => {
    const created = await create.execute(RANI, makanSiang);
    expect(created.id).toMatch(/^trx_/);
    expect(await repository.findById(RANI, created.id)).toEqual(created);
    expect(created.userId).toBe(RANI);
  });

  it("CreateTransaction menolak transaksi bertanggal besok", async () => {
    await expect(create.execute(RANI, { ...makanSiang, occurredAt: new Date("2026-11-15T09:00:00+07:00") })).rejects.toThrow(
      ValidationError,
    );
  });

  it("ListTransactions mengurutkan dari tanggal terbaru dan memfilter type", async () => {
    await create.execute(RANI, { ...makanSiang, occurredAt: new Date("2026-11-02T09:00:00+07:00") });
    await create.execute(RANI, { ...makanSiang, occurredAt: new Date("2026-11-09T09:00:00+07:00") });
    await create.execute(RANI, { type: "income", amount: 12_500_000, category: "Gaji", note: null, occurredAt: new Date("2026-11-01T09:00:00+07:00") });

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
    const update = new UpdateTransaction(repository, fixedClock);
    await expect(update.execute(RANI, created.id, { type: "income" })).rejects.toThrow(ValidationError);
  });

  it("UpdateTransaction mengubah nominal", async () => {
    const created = await create.execute(RANI, makanSiang);
    const updated = await new UpdateTransaction(repository, fixedClock).execute(RANI, created.id, { amount: 90_000 });
    expect(updated.amount).toBe(90_000);
    expect(updated.category).toBe("Makan & Minum");
  });

  it("DeleteTransaction melempar NotFoundError untuk id yang tidak ada", async () => {
    await expect(new DeleteTransaction(repository).execute(RANI, "trx_tidak_ada")).rejects.toThrow(NotFoundError);
  });

  describe("transaksi milik user lain", () => {
    it("tidak muncul di daftar milik Rani", async () => {
      await create.execute(BUDI, makanSiang);
      expect(await new ListTransactions(repository).execute(RANI)).toEqual({ items: [], nextCursor: null });
    });

    it("dianggap tidak ada saat dibuka, diubah, atau dihapus Rani (NotFoundError)", async () => {
      const milikBudi = await create.execute(BUDI, makanSiang);

      await expect(new GetTransaction(repository).execute(RANI, milikBudi.id)).rejects.toThrow(NotFoundError);
      await expect(
        new UpdateTransaction(repository, fixedClock).execute(RANI, milikBudi.id, { amount: 1 }),
      ).rejects.toThrow(NotFoundError);
      await expect(new DeleteTransaction(repository).execute(RANI, milikBudi.id)).rejects.toThrow(NotFoundError);

      // Transaksi Budi tetap utuh.
      expect(await repository.findById(BUDI, milikBudi.id)).toEqual(milikBudi);
    });
  });

  describe("GetSummary", () => {
    const november = { from: new Date("2026-11-01T00:00:00+07:00"), to: new Date("2026-11-30T23:59:59.999+07:00") };
    const gaji = { type: "income" as const, amount: 12_500_000, category: "Gaji", note: null, occurredAt: new Date("2026-11-01T09:00:00+07:00") };
    const kos = { type: "expense" as const, amount: 1_850_000, category: "Tagihan", note: "Cicilan kos", occurredAt: new Date("2026-11-02T09:00:00+07:00") };

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
          { category: "Tagihan", amount: 1_850_000 },
          { category: "Makan & Minum", amount: 100_000 },
        ],
      });
    });

    it("hanya menghitung transaksi milik user itu dan di dalam periode", async () => {
      await create.execute(RANI, { ...kos, occurredAt: new Date("2026-10-31T23:59:00+07:00") });
      await create.execute(BUDI, kos);

      const summary = await new GetSummary(repository).execute(RANI, november);

      expect(summary).toEqual({ totalIncome: 0, totalExpense: 0, netCashflow: 0, transactionCount: 0, incomeCount: 0, expenseCount: 0, expenseByCategory: [] });
    });

    it("arus kas bersih bisa negatif", async () => {
      await create.execute(RANI, kos);
      const summary = await new GetSummary(repository).execute(RANI, november);
      expect(summary.netCashflow).toBe(-1_850_000);
    });
  });
});
