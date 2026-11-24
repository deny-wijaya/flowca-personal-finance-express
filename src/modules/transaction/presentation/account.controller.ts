import type { RequestHandler } from "express";
import { toPageDto } from "../../../shared/http/pagination.ts";
import { authOf } from "../../../shared/http/middlewares/require-auth.ts";
import { parseRequest } from "../../../shared/http/validate.ts";
import type { CreateAccount } from "../application/create-account.ts";
import type { ListAccounts } from "../application/list-accounts.ts";
import { createAccountBodySchema, encodeAccountCursor, listAccountsQuerySchema, toAccountDto } from "./account.schemas.ts";

export type AccountUseCases = {
  listAccounts: ListAccounts;
  createAccount: CreateAccount;
};

/** Controller /accounts. Router-nya dipasangi requireAuth, jadi `authOf(req).userId` selalu terisi. */
export function createAccountController(useCases: AccountUseCases) {
  const list: RequestHandler = async (req, res) => {
    const { limit, cursor } = parseRequest(listAccountsQuerySchema, req.query);
    const page = await useCases.listAccounts.execute(authOf(req).userId, { limit, after: cursor });
    const nextCursor = page.nextCursor ? encodeAccountCursor(page.nextCursor) : null;
    res.json({ data: page.items.map(toAccountDto), page: toPageDto(limit, nextCursor) });
  };

  const create: RequestHandler = async (req, res) => {
    const { opening_balance, ...rest } = parseRequest(createAccountBodySchema, req.body);
    const account = await useCases.createAccount.execute(authOf(req).userId, { ...rest, openingBalance: opening_balance });
    res.status(201).json({ data: toAccountDto(account) });
  };

  return { list, create };
}

export type AccountController = ReturnType<typeof createAccountController>;
