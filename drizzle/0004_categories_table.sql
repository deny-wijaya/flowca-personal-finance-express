CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" varchar(30) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "category_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_id_type_name_idx" ON "categories" USING btree ("user_id","type",lower("name"));--> statement-breakpoint
-- Ditulis manual (tidak ada di transaction.table.ts): aturan arsitektur melarang modul transaction
-- meng-import tabel users dari modul auth. Kalau user dihapus, kategori kustomnya ikut terhapus.
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Kategori bawaan, sama dengan DEFAULT_CATEGORIES di src/modules/transaction/domain/category.ts.
-- created_at dibuat berurutan supaya GET /categories (urut created_at, id) menampilkannya sesuai urutan ini.
INSERT INTO "categories" ("id", "user_id", "name", "type", "created_at") VALUES
  ('cat_expense_makanan', NULL, 'Makanan', 'expense', '2000-01-01T00:00:01Z'),
  ('cat_expense_transportasi', NULL, 'Transportasi', 'expense', '2000-01-01T00:00:02Z'),
  ('cat_expense_belanja', NULL, 'Belanja', 'expense', '2000-01-01T00:00:03Z'),
  ('cat_expense_tagihan', NULL, 'Tagihan', 'expense', '2000-01-01T00:00:04Z'),
  ('cat_expense_hiburan', NULL, 'Hiburan', 'expense', '2000-01-01T00:00:05Z'),
  ('cat_expense_kesehatan', NULL, 'Kesehatan', 'expense', '2000-01-01T00:00:06Z'),
  ('cat_expense_pendidikan', NULL, 'Pendidikan', 'expense', '2000-01-01T00:00:07Z'),
  ('cat_expense_lainnya', NULL, 'Lainnya', 'expense', '2000-01-01T00:00:08Z'),
  ('cat_income_gaji', NULL, 'Gaji', 'income', '2000-01-01T00:00:09Z'),
  ('cat_income_freelance', NULL, 'Freelance', 'income', '2000-01-01T00:00:10Z'),
  ('cat_income_bonus', NULL, 'Bonus', 'income', '2000-01-01T00:00:11Z'),
  ('cat_income_hadiah', NULL, 'Hadiah', 'income', '2000-01-01T00:00:12Z'),
  ('cat_income_investasi', NULL, 'Investasi', 'income', '2000-01-01T00:00:13Z'),
  ('cat_income_lainnya', NULL, 'Lainnya', 'income', '2000-01-01T00:00:14Z');--> statement-breakpoint
-- Memindahkan teks kategori lama ke category_id. "Makan & Minum" (nama lama di backend) menjadi Makanan.
UPDATE "transactions" AS t SET "category_id" = c."id"
FROM "categories" AS c
WHERE c."user_id" IS NULL
  AND c."type" = t."type"
  AND lower(c."name") = lower(CASE WHEN t."category" = 'Makan & Minum' THEN 'Makanan' ELSE t."category" END);--> statement-breakpoint
-- Teks kategori yang tidak dikenal masuk ke Lainnya sesuai jenisnya.
UPDATE "transactions" SET "category_id" = 'cat_' || "type" || '_lainnya' WHERE "category_id" IS NULL;
