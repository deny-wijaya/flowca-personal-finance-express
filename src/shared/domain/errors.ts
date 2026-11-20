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

/** Data yang dicari tidak ada, misalnya transaksi dengan id tertentu. */
export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}
