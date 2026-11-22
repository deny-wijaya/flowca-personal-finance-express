import type { Request, RequestHandler } from "express";
import { UnauthorizedError } from "../../domain/errors.ts";

/** Siapa pemilik request ini. Diisi oleh `requireAuth` setelah token terbukti valid. */
export type RequestAuth = { userId: string };

declare module "express-serve-static-core" {
  interface Request {
    /** Hanya terisi di route yang dipasangi `requireAuth`. Baca lewat `authOf(req)`. */
    auth?: RequestAuth;
  }
}

/**
 * Membuat middleware yang mewajibkan header `Authorization: Bearer <token>`.
 *
 * Pemeriksa token diterima lewat parameter, bukan di-import, karena `shared/` tidak boleh
 * bergantung pada `modules/`. Container yang memasukkan pemeriksa dari modul auth (JoseTokenVerifier).
 *
 * Kalau token valid, id user disimpan di `req.auth` lalu request diteruskan dengan `next()`.
 * Kalau tidak, UnauthorizedError dilempar dan errorHandler membalas 401. Express 5 meneruskan
 * error dari middleware async ke errorHandler, jadi tidak perlu try/catch.
 */
export function createRequireAuth(verify: (token: string) => Promise<RequestAuth>): RequestHandler {
  return async (req, _res, next) => {
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) throw new UnauthorizedError("Kamu perlu masuk dulu.");
    req.auth = await verify(token);
    next();
  };
}

/** Mengambil `req.auth` di controller. Melempar 401 kalau route lupa dipasangi `requireAuth`. */
export function authOf(req: Request): RequestAuth {
  if (!req.auth) throw new UnauthorizedError("Kamu perlu masuk dulu.");
  return req.auth;
}
