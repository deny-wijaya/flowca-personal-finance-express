import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { Router, type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Container } from "./di/container.ts";
import { createAccountRouter } from "./modules/transaction/presentation/account.routes.ts";
import { createCategoryRouter } from "./modules/transaction/presentation/category.routes.ts";
import { createAuthRouter } from "./modules/auth/presentation/auth.routes.ts";
import { createSummaryRouter, createTransactionRouter } from "./modules/transaction/presentation/transaction.routes.ts";
import type { Logger } from "./shared/logger/logger.ts";
import { errorHandler } from "./shared/http/middlewares/error-handler.ts";
import { createFailedAttemptLimit } from "./shared/http/middlewares/rate-limit.ts";
import { createRequireAuth } from "./shared/http/middlewares/require-auth.ts";
import { notFoundHandler } from "./shared/http/middlewares/not-found.ts";

export type AppOptions = {
  container: Container;
  logger: Logger;
  apiPrefix: string;
  corsOrigins: string[];
  /** Nilai "trust proxy" Express. Bawaannya "loopback": hanya percaya X-Forwarded-For dari 127.0.0.1 / ::1. */
  trustProxy?: string;
};

/**
 * Membuat aplikasi Express tanpa menjalankan `listen()`.
 * Dipisah dari main.ts supaya test (supertest) bisa memakai app yang sama tanpa membuka port.
 *
 * Urutan middleware penting: logging -> security -> parsing body -> routes -> 404 -> error handler.
 */
export function createRouterApp(container: Container): Router {
  const router = Router();
  // requireAuth dipasang per router, bukan untuk semua route: /auth/register dan /auth/login
  // harus bisa dipanggil oleh user yang belum punya token.
  const requireAuth = createRequireAuth((token) => container.tokenVerifier.verify(token));
  // PRD C5: maksimal 5 login gagal per menit per IP user.
  const loginLimit = createFailedAttemptLimit({
    windowMs: 60_000,
    limit: 5,
    message: "Terlalu banyak percobaan masuk. Coba lagi dalam 1 menit.",
  });
  router.use("/transactions", requireAuth, createTransactionRouter(container.transactionController));
  router.use("/summary", requireAuth, createSummaryRouter(container.transactionController));
  router.use("/categories", requireAuth, createCategoryRouter(container.categoryController));
  router.use("/accounts", requireAuth, createAccountRouter(container.accountController));
  router.use("/auth", createAuthRouter(container.authController, { requireAuth, loginLimit }));
  return router;
}

export function createApp({ container, logger, apiPrefix, corsOrigins, trustProxy = "loopback" }: AppOptions): Express {
  const app = express();
  // Request ke API datang dari server Next, bukan langsung dari browser. Dengan pengaturan ini,
  // `req.ip` diambil dari header X-Forwarded-For, tapi hanya kalau request datang dari alamat
  // yang dipercaya. Dari alamat lain header itu diabaikan, jadi IP tidak bisa dipalsukan.
  app.set("trust proxy", trustProxy);

  // Logger dipasang paling awal supaya `req.log` sudah tersedia untuk semua middleware berikutnya,
  // termasuk saat express.json() gagal membaca body.
  app.use(
    pinoHttp({
      logger,
      // Pakai X-Request-Id dari client kalau ada, supaya log frontend dan backend bisa dicocokkan.
      genReqId: (req, res) => {
        const id = req.headers["x-request-id"]?.toString() || randomUUID();
        res.setHeader("X-Request-Id", id);
        return id;
      },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.json({ data: { status: "ok", uptime_seconds: Math.round(process.uptime()) } });
  });


  app.use(apiPrefix, createRouterApp(container))

  // app.use(`${apiPrefix}/transactions`, createTransactionRouter(container.transactionController));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
