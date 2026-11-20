import { describe, expect, it } from "vitest";
import { ValidationError } from "../../../shared/domain/errors.ts";
import { assertValidTransaction, type NewTransaction } from "./transaction.ts";

const now = new Date("2026-11-14T10:00:00+07:00");
const valid: NewTransaction = {
  type: "expense",
  amount: 64_000,
  category: "Transportasi",
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
    ["kategori pemasukan dipakai untuk pengeluaran", { category: "Gaji" }, "category"],
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
