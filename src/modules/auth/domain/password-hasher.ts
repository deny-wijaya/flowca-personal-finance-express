/**
 * Port untuk hash password. Domain dan use case tidak tahu algoritma yang dipakai;
 * implementasi argon2 ada di infrastructure. Mengganti algoritma tidak mengubah use case.
 */
export interface PasswordHasher {
  /** Mengubah password asli menjadi hash satu arah. Hasilnya berbeda setiap dipanggil karena memakai salt acak. */
  hash(password: string): Promise<string>;
  /** True kalau `password` cocok dengan `hash`. Dipakai nanti oleh use case login. */
  verify(hash: string, password: string): Promise<boolean>;
}
