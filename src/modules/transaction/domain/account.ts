import { ConflictError, ValidationError } from "../../../shared/domain/errors.ts";
import { MAX_TRANSACTION_AMOUNT } from "./transaction.ts";

/**
 * Akun (dompet): tempat uang disimpan, misalnya Tunai, BCA, atau GoPay (API-CONTRACT.md bagian 4.8).
 * Setiap akun milik satu user. Saldo saat ini tidak disimpan, tapi dihitung dari saldo awal dan
 * transaksi di akun itu, supaya selalu cocok dengan daftar transaksi.
 */
export const ACCOUNT_KINDS = ["cash", "bank", "ewallet", "credit"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export type Account = {
  id: string;
  userId: string;
  name: string;
  kind: AccountKind;
  /** Saldo saat akun mulai dicatat. Tidak berubah oleh transaksi. Boleh negatif (utang kartu kredit). */
  openingBalance: number;
  createdAt: Date;
};

/** Akun beserta saldo saat ini: openingBalance + semua pemasukan − semua pengeluaran di akun itu. */
export type AccountWithBalance = Account & { balance: number };

export type NewAccount = Pick<Account, "name" | "kind" | "openingBalance">;

export const MAX_ACCOUNT_NAME_LENGTH = 40;

/** "  Bank   BCA " -> "Bank BCA". */
export function normalizeAccountName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function assertValidNewAccount(input: NewAccount): void {
  if (input.name.length === 0) throw new ValidationError("Nama akun wajib diisi", "name");
  if (input.name.length > MAX_ACCOUNT_NAME_LENGTH) {
    throw new ValidationError(`Nama akun maksimal ${MAX_ACCOUNT_NAME_LENGTH} karakter`, "name");
  }
  if (!Number.isInteger(input.openingBalance)) {
    throw new ValidationError("Saldo awal harus bilangan bulat", "opening_balance");
  }
  if (Math.abs(input.openingBalance) > MAX_TRANSACTION_AMOUNT) {
    throw new ValidationError("Saldo awal melebihi batas Rp 1.000.000.000.000", "opening_balance");
  }
}

/** Nama akun sudah dipakai akun lain milik user yang sama. HTTP 409. */
export class AccountAlreadyExistsError extends ConflictError {
  constructor(name: string) {
    super(`Akun ${name} sudah ada`, "ACCOUNT_ALREADY_EXISTS", "name");
    this.name = "AccountAlreadyExistsError";
  }
}

/**
 * `account` null berarti akun tidak ada ATAU milik user lain. Pesannya sengaja sama untuk kedua kasus,
 * supaya keberadaan akun user lain tidak bocor.
 */
export function assertAccountFound(account: Account | null): asserts account is Account {
  if (!account) throw new ValidationError("Akun tidak ditemukan", "account_id");
}
