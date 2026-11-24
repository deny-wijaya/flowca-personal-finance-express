import { randomUUID } from "node:crypto";
import { toPage, type PageRequest } from "../../../shared/domain/pagination.ts";
import { AccountAlreadyExistsError, type Account, type AccountWithBalance, type NewAccount } from "../domain/account.ts";
import type { AccountCursor, AccountPage, AccountRepository } from "../domain/account-repository.ts";
import type { TransactionType } from "../domain/transaction.ts";

/** Satu baris transaksi yang dibutuhkan untuk menghitung saldo akun. */
export type LedgerEntry = { accountId: string | null; type: TransactionType; amount: number };

/**
 * Akun di memori untuk test. Saldo dihitung dari `ledger`, yaitu fungsi yang mengembalikan transaksi
 * saat ini (biasanya dari InMemoryTransactionRepository), sebagai pengganti LEFT JOIN + SUM di Postgres.
 */
export class InMemoryAccountRepository implements AccountRepository {
  readonly #rows = new Map<string, Account>();
  readonly #ledger: () => Iterable<LedgerEntry>;

  constructor(ledger: () => Iterable<LedgerEntry> = () => [], seed: Account[] = []) {
    this.#ledger = ledger;
    for (const account of seed) this.#rows.set(account.id, account);
  }

  async list(userId: string, page: PageRequest<AccountCursor>): Promise<AccountPage> {
    const after = page.after;
    const rows = [...this.#rows.values()]
      .filter((account) => account.userId === userId)
      .sort(oldestFirst)
      .filter((account) => !after || oldestFirst(account, after) > 0)
      .map((account) => this.#withBalance(account));
    return toPage(rows.slice(0, page.limit + 1), page.limit, (account) => ({ createdAt: account.createdAt, id: account.id }));
  }

  async findById(userId: string, id: string): Promise<Account | null> {
    const row = this.#rows.get(id);
    return row && row.userId === userId ? row : null;
  }

  async create(userId: string, input: NewAccount): Promise<AccountWithBalance> {
    const taken = [...this.#rows.values()].some(
      (account) => account.userId === userId && account.name.toLowerCase() === input.name.toLowerCase(),
    );
    if (taken) throw new AccountAlreadyExistsError(input.name);
    const account: Account = { ...input, userId, id: `acc_${randomUUID()}`, createdAt: new Date() };
    this.#rows.set(account.id, account);
    return this.#withBalance(account);
  }

  /** Nama akun untuk InMemoryTransactionRepository (pengganti JOIN). */
  nameOf(id: string | null): string | null {
    return (id && this.#rows.get(id)?.name) || null;
  }

  #withBalance(account: Account): AccountWithBalance {
    let balance = account.openingBalance;
    for (const entry of this.#ledger()) {
      if (entry.accountId === account.id) balance += entry.type === "income" ? entry.amount : -entry.amount;
    }
    return { ...account, balance };
  }
}

function oldestFirst(a: Pick<Account, "createdAt" | "id">, b: Pick<Account, "createdAt" | "id">): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
