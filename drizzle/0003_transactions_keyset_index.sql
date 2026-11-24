DROP INDEX "transactions_user_id_occurred_at_idx";--> statement-breakpoint
CREATE INDEX "transactions_user_id_occurred_at_id_idx" ON "transactions" USING btree ("user_id","occurred_at","id");