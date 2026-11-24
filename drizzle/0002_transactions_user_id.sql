-- Transaksi yang sudah ada belum punya pemilik, sedangkan kolom user_id wajib diisi.
-- Id user dibuat acak dan berbeda di setiap database, jadi migration tidak bisa memilih pemiliknya.
-- Data lama (seed dan data uji) dihapus; isi ulang dengan: npm run db:seed -- <email pemilik>
DELETE FROM "transactions";--> statement-breakpoint
DROP INDEX "transactions_occurred_at_idx";--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
-- Ditulis manual (tidak ada di transaction.table.ts): aturan arsitektur melarang modul transaction
-- meng-import tabel users dari modul auth. Kalau user dihapus, transaksinya ikut terhapus.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_user_id_occurred_at_idx" ON "transactions" USING btree ("user_id","occurred_at");
