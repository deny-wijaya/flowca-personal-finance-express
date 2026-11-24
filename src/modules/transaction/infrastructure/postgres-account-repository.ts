import { randomUUID } from "node:crypto";
import { and, asc, eq, getTableColumns, sql } from "drizzle-orm";
import type { Database } from "../../../shared/database/database.ts";
import { isUniqueViolation } from "../../../shared/database/errors.ts";
import { toPage, type PageRequest } from "../../../shared/domain/pagination.ts";
import { AccountAlreadyExistsError, type Account, type AccountWithBalance, type NewAccount } from "../domain/account.ts";
import type { AccountCursor, AccountPage, AccountRepository } from "../domain/account-repository.ts";
import { accounts, transactions } from "./transaction.table.ts";

/**
 * Akun di Postgres. Saldo saat ini dihitung dengan satu query:
 *
 *   SELECT accounts.*, opening_balance + COALESCE(SUM(pemasukan − pengeluaran), 0) AS balance
 *   FROM accounts LEFT JOIN transactions ON transactions.account_id = accounts.id
 *   GROUP BY accounts.id
 *
 * LEFT JOIN supaya akun yang belum punya transaksi tetap muncul (SUM-nya NULL, lalu diganti 0).
 */
export class PostgresAccountRepository implements AccountRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  async list(userId: string, page: PageRequest<AccountCursor>): Promise<AccountPage> {
    const { after } = page;
    // Pemasukan dihitung positif, pengeluaran negatif. SUM bigint menghasilkan numeric (string di driver pg).
    const balance = sql<number>`${accounts.openingBalance} + coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else -${transactions.amount} end), 0)`.mapWith(Number);

    const rows = await this.#db
      .select({ ...getTableColumns(accounts), balance })
      .from(accounts)
      .leftJoin(transactions, eq(transactions.accountId, accounts.id))
      .where(
        and(
          eq(accounts.userId, userId),
          after ? sql`(${accounts.createdAt}, ${accounts.id}) > (${after.createdAt.toISOString()}::timestamptz, ${after.id})` : undefined,
        ),
      )
      // GROUP BY primary key: Postgres mengizinkan kolom lain dari tabel accounts ikut di-SELECT.
      .groupBy(accounts.id)
      .orderBy(asc(accounts.createdAt), asc(accounts.id))
      .limit(page.limit + 1);
    return toPage(rows, page.limit, (account) => ({ createdAt: account.createdAt, id: account.id }));
  }

  async findById(userId: string, id: string): Promise<Account | null> {
    const [row] = await this.#db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
    return row ?? null;
  }

  async create(userId: string, input: NewAccount): Promise<AccountWithBalance> {
    try {
      const [row] = await this.#db
        .insert(accounts)
        .values({ ...input, userId, id: `acc_${randomUUID()}` })
        .returning();
      if (!row) throw new Error("Insert akun tidak mengembalikan baris");
      // Akun baru belum punya transaksi, jadi saldonya sama dengan saldo awal.
      return { ...row, balance: row.openingBalance };
    } catch (error) {
      // Nama dobel ditolak unique index (user_id, lower(name)), termasuk saat dua request datang bersamaan.
      if (isUniqueViolation(error)) throw new AccountAlreadyExistsError(input.name);
      throw error;
    }
  }
}
