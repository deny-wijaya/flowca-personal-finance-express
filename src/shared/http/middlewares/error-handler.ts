import type { ErrorRequestHandler } from "express";
import { ConflictError, DomainError, NotFoundError, UnauthorizedError, ValidationError } from "../../domain/errors.ts";
import { HttpError } from "../http-error.ts";

type ErrorBody = { error: { code: string; message: string; details?: unknown } };

/**
 * Satu tempat untuk mengubah semua error menjadi response JSON dengan format yang sama:
 * `{ "error": { "code", "message", "details" } }`.
 *
 * Express 5 otomatis meneruskan error dari handler `async` ke middleware ini,
 * jadi controller tidak perlu try/catch.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Kalau response sudah mulai dikirim, serahkan ke handler bawaan Express.
  if (res.headersSent) return next(err);

  const { status, body } = toErrorResponse(err);

  if (status >= 500) {
    req.log.error({ err }, "Unhandled error");
  } else {
    req.log.warn({ code: body.error.code, msg: body.error.message }, "Request ditolak");
  }

  res.status(status).json(body);
};

function toErrorResponse(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof HttpError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message, details: err.details } } };
  }
  if (err instanceof ValidationError) {
    const details = err.field ? { fieldErrors: { [err.field]: [err.message] } } : undefined;
    return { status: 400, body: { error: { code: err.code, message: err.message, details } } };
  }
  if (err instanceof ConflictError) {
    const details = err.field ? { fieldErrors: { [err.field]: [err.message] } } : undefined;
    return { status: 409, body: { error: { code: err.code, message: err.message, details } } };
  }
  if (err instanceof UnauthorizedError) {
    return { status: 401, body: { error: { code: err.code, message: err.message } } };
  }
  if (err instanceof NotFoundError) {
    return { status: 404, body: { error: { code: err.code, message: err.message } } };
  }
  if (err instanceof DomainError) {
    return { status: 422, body: { error: { code: err.code, message: err.message } } };
  }
  // Error dari express.json(), misalnya body bukan JSON yang valid atau lebih dari 100kb.
  if (isBodyParserError(err)) {
    if (err.type === "entity.parse.failed") {
      return { status: 400, body: { error: { code: "INVALID_JSON", message: "Body request bukan JSON yang valid" } } };
    }
    if (err.type === "entity.too.large") {
      return { status: 413, body: { error: { code: "PAYLOAD_TOO_LARGE", message: "Body request terlalu besar" } } };
    }
  }
  // Detail error 5xx tidak dikirim ke client supaya isi internal server tidak bocor.
  return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan di server" } } };
}

/** Error dari body-parser selalu punya property `type`, contohnya "entity.parse.failed". */
function isBodyParserError(err: unknown): err is { type: string } {
  return typeof err === "object" && err !== null && "type" in err && typeof err.type === "string";
}
