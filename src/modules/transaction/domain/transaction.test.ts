import { describe, expect, it } from "vitest";
import { ValidationError } from "../../../shared/domain/errors.ts";
import { assertCategoryFits, assertValidCategoryName, normalizeCategoryName, type Category } from "./category.ts";
import { assertValidTransaction, type NewTransaction } from "./transaction.ts";

const now = new Date("2026-11-14T10:00:00+07:00");
const valid: NewTransaction = {
  type: "expense",
  amount: 64_000,
  categoryId: "cat_expense_transportasi",
  note: "Gojek ke kantor",
  occurredAt: new Date("2026-11-14T08:00:00+07:00"),
};

describe("assertValidTransaction", () => {
  it("menerima transaksi yang valid", () => {
    expect(() => assertValidTransaction(valid, now)).not.toThrow();
  });

  it.each([
    ["nominal 0", { amount: 0 }, "amount"],
    ["nominal desimal", { amount: 1500.5 }, "amount"],
    ["nominal di atas batas", { amount: 1_000_000_000_001 }, "amount"],
    ["catatan lebih dari 200 karakter", { note: "a".repeat(201) }, "note"],
    ["tanggal di masa depan", { occurredAt: new Date("2026-11-15T00:00:00+07:00") }, "occurred_at"],
  ])("menolak %s", (_label, override, field) => {
    const act = () => assertValidTransaction({ ...valid, ...override }, now);
    expect(act).toThrow(ValidationError);
    try {
      act();
    } catch (error) {
      expect((error as ValidationError).field).toBe(field);
    }
  });
});

describe("aturan kategori", () => {
  const gaji: Category = { id: "cat_income_gaji", userId: null, name: "Gaji", type: "income", createdAt: new Date() };

  it("assertCategoryFits menolak kategori yang tidak ada atau milik user lain", () => {
    expect(() => assertCategoryFits(null, "expense")).toThrow("Kategori tidak ditemukan");
  });

  it("assertCategoryFits menolak kategori pemasukan untuk pengeluaran", () => {
    expect(() => assertCategoryFits(gaji, "expense")).toThrow("Kategori Gaji tidak bisa dipakai untuk pengeluaran");
    expect(() => assertCategoryFits(gaji, "income")).not.toThrow();
  });

  it("nama kategori dirapikan, lalu wajib 1-30 karakter", () => {
    expect(normalizeCategoryName("  Bayar   kos ")).toBe("Bayar kos");
    expect(() => assertValidCategoryName("")).toThrow("Nama kategori wajib diisi");
    expect(() => assertValidCategoryName("a".repeat(31))).toThrow("Nama kategori maksimal 30 karakter");
    expect(() => assertValidCategoryName("a".repeat(30))).not.toThrow();
  });
});
