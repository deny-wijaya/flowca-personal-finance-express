import { systemClock, type Clock } from "../modules/transaction/application/clock.ts";
import { CreateTransaction } from "../modules/transaction/application/create-transaction.ts";
import { DeleteTransaction } from "../modules/transaction/application/delete-transaction.ts";
import { GetTransaction } from "../modules/transaction/application/get-transaction.ts";
import { ListTransactions } from "../modules/transaction/application/list-transactions.ts";
import { UpdateTransaction } from "../modules/transaction/application/update-transaction.ts";
import type { TransactionRepository } from "../modules/transaction/domain/transaction-repository.ts";
import {
  createSeedTransactions,
  InMemoryTransactionRepository,
} from "../modules/transaction/infrastructure/in-memory-transaction-repository.ts";
import { createTransactionController } from "../modules/transaction/presentation/transaction.controller.ts";

/**
 * Composition root: satu-satunya tempat yang merakit object konkret
 * (repository -> use case -> controller). Layer lain hanya menerima dependency lewat constructor.
 * Test bisa memberi repository dan clock sendiri lewat `overrides`.
 */
export type ContainerOverrides = {
  transactionRepository?: TransactionRepository;
  clock?: Clock;
};

export function createContainer(overrides: ContainerOverrides = {}) {
  const clock = overrides.clock ?? systemClock;
  const transactionRepository =
    overrides.transactionRepository ?? new InMemoryTransactionRepository(createSeedTransactions(clock.now()));

  const transactionController = createTransactionController({
    listTransactions: new ListTransactions(transactionRepository),
    createTransaction: new CreateTransaction(transactionRepository, clock),
    updateTransaction: new UpdateTransaction(transactionRepository, clock),
    deleteTransaction: new DeleteTransaction(transactionRepository),
    getTransaction: new GetTransaction(transactionRepository)
  });

  return { transactionController };
}

export type Container = ReturnType<typeof createContainer>;
