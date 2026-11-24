import { DEFAULT_PAGE_LIMIT, type PageRequest } from "../../../shared/domain/pagination.ts";
import type { AccountCursor, AccountPage, AccountRepository } from "../domain/account-repository.ts";

/** Use case: daftar akun dengan saldo saat ini (Dashboard, menu Akun, form Tambah transaksi). */
export class ListAccounts {
  readonly #repository: AccountRepository;

  constructor(repository: AccountRepository) {
    this.#repository = repository;
  }

  execute(userId: string, page: PageRequest<AccountCursor> = { limit: DEFAULT_PAGE_LIMIT }): Promise<AccountPage> {
    return this.#repository.list(userId, page);
  }
}
