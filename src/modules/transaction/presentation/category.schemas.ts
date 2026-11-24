import { z } from "zod";
import { cursorQuery, encodeCursor, limitQuery } from "../../../shared/http/pagination.ts";
import type { Category } from "../domain/category.ts";
import type { CategoryCursor } from "../domain/category-repository.ts";
import { TRANSACTION_TYPES } from "../domain/transaction.ts";

/** Schema request dan response kategori sesuai API-CONTRACT.md bagian 4.6. */

const typeSchema = z.enum(TRANSACTION_TYPES, { message: "Jenis harus income atau expense" });

/** Isi cursor kategori sebelum di-encode: `c` = created_at, `i` = id. */
function categoryCursorShape() {
  return z
    .object({ c: z.iso.datetime(), i: z.string().min(1) })
    .transform((c): CategoryCursor => ({ createdAt: new Date(c.c), id: c.i }));
}

export function encodeCategoryCursor(cursor: CategoryCursor): string {
  return encodeCursor({ c: cursor.createdAt.toISOString(), i: cursor.id });
}

export const listCategoriesQuerySchema = z.object({
  type: typeSchema.optional(),
  limit: limitQuery,
  cursor: cursorQuery(categoryCursorShape()).optional(),
});

/** Panjang nama dicek ulang di domain setelah spasi berlebih dirapikan. */
export const createCategoryBodySchema = z.object({
  name: z.string({ message: "Nama kategori wajib diisi" }),
  type: typeSchema,
});

export function toCategoryDto(category: Category) {
  return { id: category.id, name: category.name, type: category.type, is_default: category.userId === null };
}

export type CategoryDto = ReturnType<typeof toCategoryDto>;
