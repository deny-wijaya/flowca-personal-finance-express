CREATE TYPE "public"."account_kind" AS ENUM('cash', 'bank', 'ewallet', 'credit');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(40) NOT NULL,
	"kind" "account_kind" NOT NULL,
	"opening_balance" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "account_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_user_id_name_idx" ON "accounts" USING btree ("user_id",lower("name"));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_account_id_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
-- Ditulis manual (tidak ada di transaction.table.ts): aturan arsitektur melarang modul transaction
-- meng-import tabel users dari modul auth. Kalau user dihapus, akunnya ikut terhapus.
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
