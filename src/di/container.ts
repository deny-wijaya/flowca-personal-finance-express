import { GetCurrentUser } from "../modules/auth/application/get-current-user.ts";
import { LoginUser } from "../modules/auth/application/login-user.ts";
import { RegisterUser } from "../modules/auth/application/register-user.ts";
import { UpdateProfile } from "../modules/auth/application/update-profile.ts";
import type { PasswordHasher } from "../modules/auth/domain/password-hasher.ts";
import type { TokenIssuer } from "../modules/auth/domain/token-issuer.ts";
import type { TokenVerifier } from "../modules/auth/domain/token-verifier.ts";
import type { UserRepository } from "../modules/auth/domain/user-repository.ts";
import { Argon2PasswordHasher } from "../modules/auth/infrastructure/argon2-password-hasher.ts";
import { JoseTokenIssuer } from "../modules/auth/infrastructure/jose-token-issuer.ts";
import { JoseTokenVerifier } from "../modules/auth/infrastructure/jose-token-verifier.ts";
import { PostgresUserRepository } from "../modules/auth/infrastructure/postgres-user-repository.ts";
import { createAuthController } from "../modules/auth/presentation/auth.controller.ts";
import { systemClock, type Clock } from "../modules/transaction/application/clock.ts";
import { BulkDeleteTransactions, BulkUpdateTransactions } from "../modules/transaction/application/bulk-transactions.ts";
import { CreateAccount } from "../modules/transaction/application/create-account.ts";
import { DeleteBudget } from "../modules/transaction/application/delete-budget.ts";
import { ListBudgets } from "../modules/transaction/application/list-budgets.ts";
import { SetBudget } from "../modules/transaction/application/set-budget.ts";
import { CreateCategory } from "../modules/transaction/application/create-category.ts";
import { CreateTransaction } from "../modules/transaction/application/create-transaction.ts";
import { DeleteTransaction } from "../modules/transaction/application/delete-transaction.ts";
import { ListAccounts } from "../modules/transaction/application/list-accounts.ts";
import { ListCategories } from "../modules/transaction/application/list-categories.ts";
import { GetSummary } from "../modules/transaction/application/get-summary.ts";
import { GetTransaction } from "../modules/transaction/application/get-transaction.ts";
import { ListTransactions } from "../modules/transaction/application/list-transactions.ts";
import { UpdateTransaction } from "../modules/transaction/application/update-transaction.ts";
import type { AccountRepository } from "../modules/transaction/domain/account-repository.ts";
import type { BudgetRepository } from "../modules/transaction/domain/budget-repository.ts";
import type { CategoryRepository } from "../modules/transaction/domain/category-repository.ts";
import type { TransactionRepository } from "../modules/transaction/domain/transaction-repository.ts";
import { PostgresAccountRepository } from "../modules/transaction/infrastructure/postgres-account-repository.ts";
import { PostgresBudgetRepository } from "../modules/transaction/infrastructure/postgres-budget-repository.ts";
import { PostgresCategoryRepository } from "../modules/transaction/infrastructure/postgres-category-repository.ts";
import { PostgresTransactionRepository } from "../modules/transaction/infrastructure/postgres-transaction-repository.ts";
import { createAccountController } from "../modules/transaction/presentation/account.controller.ts";
import { createBudgetController } from "../modules/transaction/presentation/budget.controller.ts";
import { createCategoryController } from "../modules/transaction/presentation/category.controller.ts";
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
  categoryRepository?: CategoryRepository;
  accountRepository?: AccountRepository;
  budgetRepository?: BudgetRepository;
  userRepository?: UserRepository;
  passwordHasher?: PasswordHasher;
  /** Wajib diisi kalau `tokenIssuer` atau `tokenVerifier` tidak diberikan. */
  jwtSecret?: string;
  /** Masa berlaku access token dalam detik. Bawaannya 1 hari. */
  jwtExpiresIn?: number;
  tokenIssuer?: TokenIssuer;
  tokenVerifier?: TokenVerifier;
  clock?: Clock;
};

export function createContainer(overrides: ContainerOverrides = {}) {
  const clock = overrides.clock ?? systemClock;
  const needsDatabase =
    !overrides.transactionRepository ||
    !overrides.categoryRepository ||
    !overrides.accountRepository ||
    !overrides.budgetRepository ||
    !overrides.userRepository;
  const database = needsDatabase ? openDatabase(overrides.databaseUrl) : undefined;
  const transactionRepository =
    overrides.transactionRepository ?? new PostgresTransactionRepository(database!.db);
  const categoryRepository = overrides.categoryRepository ?? new PostgresCategoryRepository(database!.db);
  const accountRepository = overrides.accountRepository ?? new PostgresAccountRepository(database!.db);
  const budgetRepository = overrides.budgetRepository ?? new PostgresBudgetRepository(database!.db);
  const userRepository = overrides.userRepository ?? new PostgresUserRepository(database!.db);
  const passwordHasher = overrides.passwordHasher ?? new Argon2PasswordHasher();
  const tokenIssuer = overrides.tokenIssuer ?? createTokenIssuer(overrides);
  const tokenVerifier = overrides.tokenVerifier ?? new JoseTokenVerifier({ secret: requireJwtSecret(overrides) });

  const transactionController = createTransactionController({
    listTransactions: new ListTransactions(transactionRepository),
    createTransaction: new CreateTransaction(transactionRepository, categoryRepository, accountRepository, clock),
    updateTransaction: new UpdateTransaction(transactionRepository, categoryRepository, accountRepository, clock),
    deleteTransaction: new DeleteTransaction(transactionRepository),
    getTransaction: new GetTransaction(transactionRepository),
    getSummary: new GetSummary(transactionRepository),
    bulkDeleteTransactions: new BulkDeleteTransactions(transactionRepository),
    bulkUpdateTransactions: new BulkUpdateTransactions(transactionRepository, categoryRepository, accountRepository),
  });

  const categoryController = createCategoryController({
    listCategories: new ListCategories(categoryRepository),
    createCategory: new CreateCategory(categoryRepository),
  });

  const accountController = createAccountController({
    listAccounts: new ListAccounts(accountRepository),
    createAccount: new CreateAccount(accountRepository),
  });

  const budgetController = createBudgetController({
    listBudgets: new ListBudgets(budgetRepository),
    setBudget: new SetBudget(budgetRepository, categoryRepository),
    deleteBudget: new DeleteBudget(budgetRepository),
  });

  const authController = createAuthController({
    registerUser: new RegisterUser(userRepository, passwordHasher),
    loginUser: new LoginUser(userRepository, passwordHasher, tokenIssuer),
    getCurrentUser: new GetCurrentUser(userRepository),
    updateProfile: new UpdateProfile(userRepository),
  });

  // Satu pool dipakai bersama oleh semua repository Postgres, dan ditutup sekali saat shutdown.
  const close = database ? database.close : async () => {};

  // tokenVerifier dipakai app.ts untuk membuat middleware requireAuth.
  return { transactionController, categoryController, accountController, budgetController, authController, tokenVerifier, close };
}

function createTokenIssuer(overrides: ContainerOverrides): TokenIssuer {
  return new JoseTokenIssuer({ secret: requireJwtSecret(overrides), expiresIn: overrides.jwtExpiresIn ?? 86_400 });
}

function requireJwtSecret({ jwtSecret }: ContainerOverrides): string {
  if (!jwtSecret) throw new Error("createContainer butuh jwtSecret kalau tokenIssuer atau tokenVerifier tidak diberikan");
  return jwtSecret;
}

function openDatabase(databaseUrl: string | undefined) {
  if (!databaseUrl) {
    throw new Error("createContainer butuh databaseUrl kalau ada repository yang tidak diberikan lewat overrides");
  }
  return createDatabase(databaseUrl);
}

export type Container = ReturnType<typeof createContainer>;
