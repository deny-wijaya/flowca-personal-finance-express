/**
 * Standar pagination untuk semua endpoint daftar (API-CONTRACT.md bagian 1).
 * Type di sini tidak tahu isi cursor. Setiap modul menentukan sendiri isi cursor-nya (`TCursor`),
 * misalnya modul transaksi memakai `{ occurredAt, id }` dari item terakhir di halaman.
 */
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/** Permintaan satu halaman: ambil `limit` item sesudah posisi `after`. Tanpa `after` berarti halaman pertama. */
export type PageRequest<TCursor> = { limit: number; after?: TCursor };

/** Satu halaman hasil. `nextCursor` bernilai null kalau tidak ada halaman berikutnya. */
export type Page<TItem, TCursor> = { items: TItem[]; nextCursor: TCursor | null };

/**
 * Memotong hasil query yang diambil `limit + 1` baris menjadi satu halaman.
 * Baris ekstra hanya dipakai untuk tahu masih ada halaman berikutnya atau tidak, lalu dibuang.
 */
export function toPage<TItem, TCursor>(rows: TItem[], limit: number, cursorOf: (item: TItem) => TCursor): Page<TItem, TCursor> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const hasMore = rows.length > limit;
  return { items, nextCursor: hasMore && last ? cursorOf(last) : null };
}
