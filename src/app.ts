import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { Router, type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Container } from "./di/container.ts";
import { createTransactionRouter } from "./modules/transaction/presentation/transaction.routes.ts";
import type { Logger } from "./shared/logger/logger.ts";
import { errorHandler } from "./shared/http/middlewares/error-handler.ts";
import { notFoundHandler } from "./shared/http/middlewares/not-found.ts";

export type AppOptions = {
  container: Container;
  logger: Logger;
  apiPrefix: string;
  corsOrigins: string[];
};

/**
 * Membuat aplikasi Express tanpa menjalankan `listen()`.
 * Dipisah dari main.ts supaya test (supertest) bisa memakai app yang sama tanpa membuka port.
 *
 * Urutan middleware penting: logging -> security -> parsing body -> routes -> 404 -> error handler.
 */
export function createRouterApp(container: Container): Router {
  const router = Router();
  router.use("/transactions", createTransactionRouter(container.transactionController))
  return router;
}

export function createApp({ container, logger, apiPrefix, corsOrigins }: AppOptions): Express {
  const app = express();

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
