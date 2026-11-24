import type { Page, PageRequest } from "../../../shared/domain/pagination.ts";
import type { Account, AccountWithBalance, NewAccount } from "./account.ts";

/** Posisi akun terakhir di satu halaman. Urutan daftar akun adalah (createdAt, id). */
export type AccountCursor = { createdAt: Date; id: string };

export type AccountPage = Page<AccountWithBalance, AccountCursor>;

/** Kontrak penyimpanan akun. Semua method hanya melihat akun milik `userId`. */
export interface AccountRepository {
  /** Akun milik `userId` beserta saldo saat ini, urut (createdAt, id). */
  list(userId: string, page: PageRequest<AccountCursor>): Promise<AccountPage>;
  /** null kalau akun tidak ada atau milik user lain. */
  findById(userId: string, id: string): Promise<Account | null>;
  /** Melempar AccountAlreadyExistsError kalau nama (tanpa beda huruf besar kecil) sudah dipakai user itu. */
  create(userId: string, input: NewAccount): Promise<AccountWithBalance>;
}
