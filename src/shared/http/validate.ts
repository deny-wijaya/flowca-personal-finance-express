import { z } from "zod";
import { HttpError } from "./http-error.ts";

/**
 * Validasi input request (body, query, params) dengan zod.
 * Kalau gagal, lempar HttpError 400 yang berisi pesan per field,
 * contohnya `{ amount: ["Nominal wajib diisi"] }`.
 */
export function parseRequest<TSchema extends z.ZodType>(schema: TSchema, input: unknown): z.infer<TSchema> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new HttpError(400, "VALIDATION_ERROR", "Data request tidak valid", z.flattenError(parsed.error));
  }
  return parsed.data;
}
