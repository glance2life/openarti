ALTER TABLE "arti_file_snapshot" DROP CONSTRAINT "arti_file_snapshot_last_commit_id_arti_commits_id_fk";
--> statement-breakpoint
ALTER TABLE "collections" ALTER COLUMN "storage_path" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "arti_file_snapshot" ADD CONSTRAINT "arti_file_snapshot_last_commit_id_arti_commits_id_fk" FOREIGN KEY ("last_commit_id") REFERENCES "public"."arti_commits"("id") ON DELETE cascade ON UPDATE no action;