import type { RequestHandler } from "express";
import { authOf } from "../../../shared/http/middlewares/require-auth.ts";
import { toPageDto } from "../../../shared/http/pagination.ts";
import { parseRequest } from "../../../shared/http/validate.ts";
import type { CreateTransaction } from "../application/create-transaction.ts";
import type { DeleteTransaction } from "../application/delete-transaction.ts";
import type { ListTransactions } from "../application/list-transactions.ts";
import type { UpdateTransaction } from "../application/update-transaction.ts";
import type { GetTransaction } from "../application/get-transaction.ts";
import type { GetSummary } from "../application/get-summary.ts";
import {
  createTransactionBodySchema,
  encodeTransactionCursor,
  listTransactionsQuerySchema,
  summaryQuerySchema,
  toSummaryDto,
  toTransactionDto,
  transactionIdParamsSchema,
  updateTransactionBodySchema,
} from "./transaction.schemas.ts";


export type TransactionUseCases = {
  listTransactions: ListTransactions;
  getTransaction: GetTransaction;
  createTransaction: CreateTransaction;
  updateTransaction: UpdateTransaction;
  deleteTransaction: DeleteTransaction;
  getSummary: GetSummary;
};

/**
 * Controller sengaja tipis. Tugasnya hanya tiga:
 * 1) validasi request, 2) panggil use case, 3) bentuk response.
 * Router /transactions dipasangi requireAuth, jadi `authOf(req).userId` selalu berisi pemilik token.
 * Tidak ada try/catch karena Express 5 meneruskan error async ke errorHandler.
 */
export function createTransactionController(useCases: TransactionUseCases) {
  const list: RequestHandler = async (req, res) => {
    const { limit, cursor, ...filter } = parseRequest(listTransactionsQuerySchema, req.query);
    const page = await useCases.listTransactions.execute(authOf(req).userId, filter, { limit, after: cursor });
    const nextCursor = page.nextCursor ? encodeTransactionCursor(page.nextCursor) : null;
    res.json({ data: page.items.map(toTransactionDto), page: toPageDto(limit, nextCursor) });
  };

  const get: RequestHandler = async (req, res) => {
    const { id } = parseRequest(transactionIdParamsSchema, req.params);
    const transaction = await useCases.getTransaction.execute(authOf(req).userId, id);
    res.json({ data: toTransactionDto(transaction) });
  };

  const create: RequestHandler = async (req, res) => {
    const body = parseRequest(createTransactionBodySchema, req.body);
    const { occurred_at, ...rest } = body;
    const transaction = await useCases.createTransaction.execute(authOf(req).userId, { ...rest, occurredAt: occurred_at });
    res.status(201).json({ data: toTransactionDto(transaction) });
  };

  const update: RequestHandler = async (req, res) => {
    const { id } = parseRequest(transactionIdParamsSchema, req.params);
    const { occurred_at, ...rest } = parseRequest(updateTransactionBodySchema, req.body);
    const transaction = await useCases.updateTransaction.execute(authOf(req).userId, id, {
      ...rest,
      occurredAt: occurred_at,
    });
    res.json({ data: toTransactionDto(transaction) });
  };

  const remove: RequestHandler = async (req, res) => {
    const { id } = parseRequest(transactionIdParamsSchema, req.params);
    await useCases.deleteTransaction.execute(authOf(req).userId, id);
    res.status(204).end();
  };

  const summary: RequestHandler = async (req, res) => {
    const range = parseRequest(summaryQuerySchema, req.query);
    const result = await useCases.getSummary.execute(authOf(req).userId, range);
    res.json({ data: toSummaryDto(result) });
  };

  return { list, create, update, remove, get, summary };
}

export type TransactionController = ReturnType<typeof createTransactionController>;
