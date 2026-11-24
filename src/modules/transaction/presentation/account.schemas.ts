import { z } from "zod";
import { cursorQuery, encodeCursor, limitQuery } from "../../../shared/http/pagination.ts";
import { ACCOUNT_KINDS, type AccountWithBalance } from "../domain/account.ts";
import type { AccountCursor } from "../domain/account-repository.ts";

/** Schema request dan response akun sesuai API-CONTRACT.md bagian 4.8. */

/** Isi cursor akun sebelum di-encode: `c` = created_at, `i` = id. */
function accountCursorShape() {
  return z
    .object({ c: z.iso.datetime(), i: z.string().min(1) })
    .transform((c): AccountCursor => ({ createdAt: new Date(c.c), id: c.i }));
}

export function encodeAccountCursor(cursor: AccountCursor): string {
  return encodeCursor({ c: cursor.createdAt.toISOString(), i: cursor.id });
}

export const listAccountsQuerySchema = z.object({
  limit: limitQuery,
  cursor: cursorQuery(accountCursorShape()).optional(),
});

/** Panjang nama dan batas saldo dicek ulang di domain setelah nama dirapikan. */
export const createAccountBodySchema = z.object({
  name: z.string({ message: "Nama akun wajib diisi" }),
  kind: z.enum(ACCOUNT_KINDS, { message: "Jenis akun harus cash, bank, ewallet, atau credit" }),
  opening_balance: z.number({ message: "Saldo awal wajib berupa angka" }),
});

export function toAccountDto(account: AccountWithBalance) {
  return {
    id: account.id,
    name: account.name,
    kind: account.kind,
    opening_balance: account.openingBalance,
    balance: account.balance,
    created_at: account.createdAt.toISOString(),
  };
}

export type AccountDto = ReturnType<typeof toAccountDto>;
