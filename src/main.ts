import { createApp } from "./app.ts";
import { loadEnv } from "./config/env.ts";
import { createContainer } from "./di/container.ts";
import { createLogger } from "./shared/logger/logger.ts";

/** Entry point: baca env, rakit dependency, lalu jalankan server HTTP. */
const env = loadEnv();
const logger = createLogger({ level: env.LOG_LEVEL, pretty: env.NODE_ENV === "development" });
const app = createApp({
  container: createContainer(),
  logger,
  apiPrefix: env.API_PREFIX,
  corsOrigins: env.CORS_ORIGINS,
});

const server = app.listen(env.PORT, (error) => {
  if (error) {
    logger.fatal({ err: error }, "Server gagal start");
    process.exit(1);
  }
  logger.info(`API siap di http://localhost:${env.PORT}${env.API_PREFIX}`);
});

/**
 * Graceful shutdown: saat proses diminta berhenti (Ctrl+C atau deploy baru),
 * server berhenti menerima koneksi baru tetapi menyelesaikan request yang sedang berjalan.
 */
function shutdown(signal: NodeJS.Signals) {
  logger.info(`${signal} diterima, server dimatikan...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
