import { ValidationError } from "../../../shared/domain/errors.ts";

/**
 * Entity Transaction dan aturan bisnisnya.
 * Layer domain tidak boleh import Express, zod, atau database. Isinya TypeScript murni,
 * jadi aturan ini tetap sama walaupun nanti framework atau database diganti.
 */
export const TRANSACTION_TYPES = ["income", "expense"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_CATEGORIES = {
  income: ["Gaji", "Bonus", "Freelance", "Investasi", "Lainnya"],
  expense: ["Makan & Minum", "Transportasi", "Tagihan", "Belanja", "Hiburan", "Kesehatan", "Lainnya"],
} as const satisfies Record<TransactionType, readonly string[]>;

export const MAX_TRANSACTION_AMOUNT = 1_000_000_000_000;
export const MAX_NOTE_LENGTH = 200;

export type Transaction = {
  id: string;
  /** Pemilik transaksi (id dari tabel users). Setiap user hanya bisa melihat dan mengubah miliknya sendiri. */
  userId: string;
  type: TransactionType;
  /** Nominal dalam Rupiah, bilangan bulat positif (tanpa desimal). */
  amount: number;
  category: string;
  note: string | null;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

/** Data yang dikirim user saat membuat transaksi. Id dan timestamp diisi oleh repository. */
export type NewTransaction = Pick<Transaction, "type" | "amount" | "category" | "note" | "occurredAt">;

/** Field yang boleh diubah lewat PATCH. */
export type TransactionChanges = Partial<NewTransaction>;

/** Aturan bisnis untuk isi transaksi. Melempar ValidationError bila tidak valid. */
export function assertValidTransaction(input: NewTransaction, now: Date): void {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new ValidationError("Nominal harus bilangan bulat lebih dari 0", "amount");
  }
  if (input.amount > MAX_TRANSACTION_AMOUNT) {
    throw new ValidationError("Nominal melebihi batas maksimal Rp 1.000.000.000.000", "amount");
  }
  const allowedCategories: readonly string[] = TRANSACTION_CATEGORIES[input.type];
  if (!allowedCategories.includes(input.category)) {
    throw new ValidationError(`Kategori "${input.category}" tidak valid untuk ${input.type}`, "category");
  }
  if (input.note && input.note.length > MAX_NOTE_LENGTH) {
    throw new ValidationError(`Catatan maksimal ${MAX_NOTE_LENGTH} karakter`, "note");
  }
  if (input.occurredAt.getTime() > now.getTime()) {
    throw new ValidationError("Tanggal transaksi tidak boleh di masa depan", "occurred_at");
  }
}
