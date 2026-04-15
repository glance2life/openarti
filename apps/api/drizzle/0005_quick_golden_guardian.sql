ALTER TABLE "arti_commit_files" ADD COLUMN "diff_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "arti_commit_files" ADD COLUMN "added_lines" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "arti_commit_files" ADD COLUMN "removed_lines" integer DEFAULT 0 NOT NULL;