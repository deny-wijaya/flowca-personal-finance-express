/** Kode error Postgres untuk pelanggaran unique constraint. */
const UNIQUE_VIOLATION = "23505";

/**
 * true kalau error berasal dari pelanggaran unique constraint (misalnya email atau nama kategori dobel).
 * Drizzle membungkus error dari driver pg, jadi kode aslinya bisa ada di `error.cause`.
 */
export function isUniqueViolation(error: unknown): boolean {
  const codeOf = (value: unknown) =>
    typeof value === "object" && value !== null && "code" in value ? value.code : undefined;
  const cause = typeof error === "object" && error !== null && "cause" in error ? error.cause : undefined;
  return codeOf(error) === UNIQUE_VIOLATION || codeOf(cause) === UNIQUE_VIOLATION;
}
