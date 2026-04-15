CREATE TABLE "arti_commit_files" (
	"commit_id" text NOT NULL,
	"collection_id" text NOT NULL,
	"path" text NOT NULL,
	"action" text NOT NULL,
	CONSTRAINT "arti_commit_files_commit_id_path_pk" PRIMARY KEY("commit_id","path")
);
--> statement-breakpoint
CREATE TABLE "arti_commits" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"parent_id" text,
	"author" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"seq" bigserial NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arti_file_snapshot" (
	"collection_id" text NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	"line_count" integer NOT NULL,
	"last_commit_id" text NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', "content")) STORED,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "arti_file_snapshot_collection_id_path_pk" PRIMARY KEY("collection_id","path")
);
--> statement-breakpoint
CREATE TABLE "arti_refs" (
	"collection_id" text NOT NULL,
	"name" text NOT NULL,
	"commit_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "arti_refs_collection_id_name_pk" PRIMARY KEY("collection_id","name")
);
--> statement-breakpoint
CREATE TABLE "arti_weave_ops" (
	"line_id" text NOT NULL,
	"commit_id" text NOT NULL,
	"collection_id" text NOT NULL,
	"path" text NOT NULL,
	"op_type" text NOT NULL,
	"text" text,
	"depth" integer,
	"anchored_right" boolean,
	"insert_seq" bigint,
	CONSTRAINT "arti_weave_ops_line_id_commit_id_pk" PRIMARY KEY("line_id","commit_id")
);
--> statement-breakpoint
ALTER TABLE "arti_commit_files" ADD CONSTRAINT "arti_commit_files_commit_id_arti_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "public"."arti_commits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arti_commits" ADD CONSTRAINT "arti_commits_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arti_file_snapshot" ADD CONSTRAINT "arti_file_snapshot_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arti_file_snapshot" ADD CONSTRAINT "arti_file_snapshot_last_commit_id_arti_commits_id_fk" FOREIGN KEY ("last_commit_id") REFERENCES "public"."arti_commits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arti_refs" ADD CONSTRAINT "arti_refs_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arti_refs" ADD CONSTRAINT "arti_refs_commit_id_arti_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "public"."arti_commits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arti_weave_ops" ADD CONSTRAINT "arti_weave_ops_commit_id_arti_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "public"."arti_commits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "arti_commit_files_col_path" ON "arti_commit_files" USING btree ("collection_id","path","commit_id");--> statement-breakpoint
CREATE INDEX "arti_commits_collection_seq" ON "arti_commits" USING btree ("collection_id","seq" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "arti_commits_parent" ON "arti_commits" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "arti_file_snapshot_tsv" ON "arti_file_snapshot" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "arti_file_snapshot_col_path_pattern" ON "arti_file_snapshot" USING btree ("collection_id","path");--> statement-breakpoint
CREATE INDEX "arti_weave_ops_col_path_commit" ON "arti_weave_ops" USING btree ("collection_id","path","commit_id");--> statement-breakpoint
CREATE INDEX "arti_weave_ops_line" ON "arti_weave_ops" USING btree ("line_id");