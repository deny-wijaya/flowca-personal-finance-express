import { systemClock, type Clock } from "../modules/transaction/application/clock.ts";
import { CreateTransaction } from "../modules/transaction/application/create-transaction.ts";
import { DeleteTransaction } from "../modules/transaction/application/delete-transaction.ts";
import { GetTransaction } from "../modules/transaction/application/get-transaction.ts";
import { ListTransactions } from "../modules/transaction/application/list-transactions.ts";
import { UpdateTransaction } from "../modules/transaction/application/update-transaction.ts";
import type { TransactionRepository } from "../modules/transaction/domain/transaction-repository.ts";
import { PostgresTransactionRepository } from "../modules/transaction/infrastructure/postgres-transaction-repository.ts";
import { createTransactionController } from "../modules/transaction/presentation/transaction.controller.ts";
import { createDatabase } from "../shared/database/database.ts";

/**
 * Composition root: satu-satunya tempat yang merakit object konkret
 * (repository -> use case -> controller). Layer lain hanya menerima dependency lewat constructor.
 * Test bisa memberi repository dan clock sendiri lewat `overrides`. Kalau repository diberikan,
 * container tidak membuka koneksi database sama sekali, jadi test HTTP tidak butuh Docker.
 */
export type ContainerOverrides = {
  /** Wajib diisi kalau `transactionRepository` tidak diberikan. */
  databaseUrl?: string;
  transactionRepository?: TransactionRepository;
  clock?: Clock;
};

export function createContainer(overrides: ContainerOverrides = {}) {
  const clock = overrides.clock ?? systemClock;
  const { transactionRepository, close } = createTransactionRepository(overrides);

  const transactionController = createTransactionController({
    listTransactions: new ListTransactions(transactionRepository),
    createTransaction: new CreateTransaction(transactionRepository, clock),
    updateTransaction: new UpdateTransaction(transactionRepository, clock),
    deleteTransaction: new DeleteTransaction(transactionRepository),
    getTransaction: new GetTransaction(transactionRepository),
  });

  return { transactionController, close };
}

function createTransactionRepository(overrides: ContainerOverrides): {
  transactionRepository: TransactionRepository;
  close: () => Promise<void>;
} {
  if (overrides.transactionRepository) {
    return { transactionRepository: overrides.transactionRepository, close: async () => {} };
  }
  if (!overrides.databaseUrl) {
    throw new Error("createContainer butuh databaseUrl kalau transactionRepository tidak diberikan");
  }
  const { db, close } = createDatabase(overrides.databaseUrl);
  return { transactionRepository: new PostgresTransactionRepository(db), close };
}

export type Container = ReturnType<typeof createContainer>;
