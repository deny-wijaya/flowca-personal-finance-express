/**
 * Error bisnis. Dilempar oleh layer domain/application tanpa tahu apa pun soal HTTP.
 * Middleware `errorHandler` yang menerjemahkannya menjadi status code dan response JSON.
 */
export class DomainError extends Error {
  readonly code: string;

  constructor(message: string, code = "DOMAIN_ERROR") {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

/** Data tidak memenuhi aturan bisnis, misalnya nominal 0 atau tanggal di masa depan. */
export class ValidationError extends DomainError {
  readonly field: string | undefined;

  constructor(message: string, field?: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.field = field;
  }
}

/**
 * Data bentrok dengan data yang sudah ada, misalnya register dengan email yang sudah terdaftar.
 * Request-nya sendiri valid; ia ditolak karena keadaan data di server (HTTP 409).
 */
export class ConflictError extends DomainError {
  readonly field: string | undefined;

  constructor(message: string, code: string, field?: string) {
    super(message, code);
    this.name = "ConflictError";
    this.field = field;
  }
}

/** Identitas tidak bisa dipastikan, misalnya password salah atau token tidak valid (HTTP 401). */
export class UnauthorizedError extends DomainError {
  constructor(message: string, code = "UNAUTHORIZED") {
    super(message, code);
    this.name = "UnauthorizedError";
  }
}

/** Data yang dicari tidak ada, misalnya transaksi dengan id tertentu. */
export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}
