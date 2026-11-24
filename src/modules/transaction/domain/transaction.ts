import { ValidationError } from "../../../shared/domain/errors.ts";

/**
 * Entity Transaction dan aturan bisnisnya.
 * Layer domain tidak boleh import Express, zod, atau database. Isinya TypeScript murni,
 * jadi aturan ini tetap sama walaupun nanti framework atau database diganti.
 */
export const TRANSACTION_TYPES = ["income", "expense"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const MAX_TRANSACTION_AMOUNT = 1_000_000_000_000;
export const MAX_NOTE_LENGTH = 200;

export type Transaction = {
  id: string;
  /** Pemilik transaksi (id dari tabel users). Setiap user hanya bisa melihat dan mengubah miliknya sendiri. */
  userId: string;
  type: TransactionType;
  /** Nominal dalam Rupiah, bilangan bulat positif (tanpa desimal). */
  amount: number;
  /** Id kategori (tabel categories). Aturan kategori ada di category.ts. */
  categoryId: string;
  /** Nama kategori, dibaca lewat JOIN saat transaksi diambil. Tidak disimpan di tabel transactions. */
  category: string;
  /** Id akun tempat uang masuk atau keluar. null untuk transaksi lama yang dicatat sebelum fitur akun ada. */
  accountId: string | null;
  /** Nama akun, dibaca lewat JOIN. null kalau accountId null. */
  account: string | null;
  note: string | null;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

/** Data yang dikirim user saat membuat transaksi. Id dan timestamp diisi oleh repository. */
export type NewTransaction = Pick<Transaction, "type" | "amount" | "categoryId" | "accountId" | "note" | "occurredAt">;

/** Field yang boleh diubah lewat PATCH. */
export type TransactionChanges = Partial<NewTransaction>;

/**
 * Aturan bisnis untuk isi transaksi. Melempar ValidationError bila tidak valid.
 * Kecocokan kategori dicek terpisah dengan assertCategoryFits, karena butuh data kategori dari repository.
 */
export function assertValidTransaction(input: NewTransaction, now: Date): void {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new ValidationError("Nominal harus bilangan bulat lebih dari 0", "amount");
  }
  if (input.amount > MAX_TRANSACTION_AMOUNT) {
    throw new ValidationError("Nominal melebihi batas maksimal Rp 1.000.000.000.000", "amount");
  }
  if (input.note && input.note.length > MAX_NOTE_LENGTH) {
    throw new ValidationError(`Catatan maksimal ${MAX_NOTE_LENGTH} karakter`, "note");
  }
  if (input.occurredAt.getTime() > now.getTime()) {
    throw new ValidationError("Tanggal transaksi tidak boleh di masa depan", "occurred_at");
  }
}
