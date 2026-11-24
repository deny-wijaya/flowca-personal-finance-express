import { assertValidNewAccount, normalizeAccountName, type AccountWithBalance, type NewAccount } from "../domain/account.ts";
import type { AccountRepository } from "../domain/account-repository.ts";

/** Use case: membuat akun dari menu Akun atau dari langkah terakhir onboarding. */
export class CreateAccount {
  readonly #repository: AccountRepository;

  constructor(repository: AccountRepository) {
    this.#repository = repository;
  }

  async execute(userId: string, input: NewAccount): Promise<AccountWithBalance> {
    const account = { ...input, name: normalizeAccountName(input.name) };
    assertValidNewAccount(account);
    return this.#repository.create(userId, account);
  }
}
