import type { RequestHandler } from "express";
import { HttpError } from "../http-error.ts";

/** Dipasang setelah semua route. Request yang tidak cocok dengan route mana pun berakhir di sini. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, "ROUTE_NOT_FOUND", `Endpoint ${req.method} ${req.path} tidak ditemukan`));
};
