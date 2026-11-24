import { DEFAULT_PAGE_LIMIT, type PageRequest } from "../../../shared/domain/pagination.ts";
import type {
  TransactionCursor,
  TransactionFilter,
  TransactionPage,
  TransactionRepository,
} from "../domain/transaction-repository.ts";

/** Use case: menampilkan daftar transaksi per halaman (dipakai menu Transaksi dan Dashboard di frontend). */
export class ListTransactions {
  readonly #repository: TransactionRepository;

  constructor(repository: TransactionRepository) {
    this.#repository = repository;
  }

  execute(
    userId: string,
    filter: TransactionFilter = {},
    page: PageRequest<TransactionCursor> = { limit: DEFAULT_PAGE_LIMIT },
  ): Promise<TransactionPage> {
    return this.#repository.list(userId, filter, page);
  }
}
