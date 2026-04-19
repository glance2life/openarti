DROP INDEX "collections_owner_name";--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "collections_owner_name" ON "collections" USING btree ("owner_id","name") WHERE "collections"."deleted_at" IS NULL;