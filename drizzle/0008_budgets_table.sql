CREATE TABLE "budgets" (
	"user_id" text NOT NULL,
	"category_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_user_id_category_id_pk" PRIMARY KEY("user_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Ditulis manual (tidak ada di transaction.table.ts): aturan arsitektur melarang modul transaction
-- meng-import tabel users dari modul auth. Kalau user dihapus, anggarannya ikut terhapus.
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
