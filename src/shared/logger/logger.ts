import { pino, type Logger } from "pino";

export type { Logger };

/**
 * Logger terstruktur (JSON). Di production, log JSON mudah dicari di tool seperti
 * Grafana Loki atau CloudWatch. Di development, pino-pretty membuatnya enak dibaca.
 */
export function createLogger(options: { level: string; pretty: boolean }): Logger {
  return pino({
    level: options.level,
    // Jangan pernah menulis token atau password ke log.
    redact: ["req.headers.authorization", "req.headers.cookie", "*.password"],
    transport: options.pretty ? { target: "pino-pretty", options: { translateTime: "SYS:HH:MM:ss" } } : undefined,
  });
}
