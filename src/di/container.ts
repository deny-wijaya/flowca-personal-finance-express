import { RegisterUser } from "../modules/auth/application/register-user.ts";
import type { PasswordHasher } from "../modules/auth/domain/password-hasher.ts";
import type { UserRepository } from "../modules/auth/domain/user-repository.ts";
import { Argon2PasswordHasher } from "../modules/auth/infrastructure/argon2-password-hasher.ts";
import { PostgresUserRepository } from "../modules/auth/infrastructure/postgres-user-repository.ts";
import { createAuthController } from "../modules/auth/presentation/auth.controller.ts";
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
 * Test bisa memberi repository, hasher, dan clock sendiri lewat `overrides`. Kalau semua repository
 * diberikan, container tidak membuka koneksi database sama sekali, jadi test HTTP tidak butuh Docker.
 */
export type ContainerOverrides = {
  /** Wajib diisi kalau ada repository yang tidak diberikan lewat overrides. */
  databaseUrl?: string;
  transactionRepository?: TransactionRepository;
  userRepository?: UserRepository;
  passwordHasher?: PasswordHasher;
  clock?: Clock;
};

export function createContainer(overrides: ContainerOverrides = {}) {
  const clock = overrides.clock ?? systemClock;
  const needsDatabase = !overrides.transactionRepository || !overrides.userRepository;
  const database = needsDatabase ? openDatabase(overrides.databaseUrl) : undefined;
  const transactionRepository =
    overrides.transactionRepository ?? new PostgresTransactionRepository(database!.db);
  const userRepository = overrides.userRepository ?? new PostgresUserRepository(database!.db);
  const passwordHasher = overrides.passwordHasher ?? new Argon2PasswordHasher();

  const transactionController = createTransactionController({
    listTransactions: new ListTransactions(transactionRepository),
    createTransaction: new CreateTransaction(transactionRepository, clock),
    updateTransaction: new UpdateTransaction(transactionRepository, clock),
    deleteTransaction: new DeleteTransaction(transactionRepository),
    getTransaction: new GetTransaction(transactionRepository),
  });

  const authController = createAuthController({
    registerUser: new RegisterUser(userRepository, passwordHasher),
  });

  // Satu pool dipakai bersama oleh semua repository Postgres, dan ditutup sekali saat shutdown.
  const close = database ? database.close : async () => {};

  return { transactionController, authController, close };
}

function openDatabase(databaseUrl: string | undefined) {
  if (!databaseUrl) {
    throw new Error("createContainer butuh databaseUrl kalau ada repository yang tidak diberikan lewat overrides");
  }
  return createDatabase(databaseUrl);
}

export type Container = ReturnType<typeof createContainer>;
