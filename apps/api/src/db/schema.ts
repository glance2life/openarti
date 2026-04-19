import { pgTable, text, timestamp, boolean, integer, index, pgEnum, uniqueIndex, bigserial, bigint, primaryKey, customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

// ---- Enums ----

export const visibilityEnum = pgEnum("visibility", ["private", "public"]);
export const pinTargetTypeEnum = pgEnum("pin_target_type", ["collection", "file", "dir"]);
export const accessLevelEnum = pgEnum("access_level", ["read", "edit"]);

// ---- better-auth managed tables ----

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  role: text("role").default("member"),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("sessions_userId_idx").on(table.userId)]
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("accounts_userId_idx").on(table.userId)]
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)]
);

// ---- App tables ----

export const collections = pgTable(
  "collections",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").default(""),
    visibility: visibilityEnum("visibility").notNull().default("private"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("collections_owner_name")
      .on(t.ownerId, t.name)
      .where(sql`${t.deletedAt} IS NULL`),
  ]
);

export const collectionAccess = pgTable(
  "collection_access",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    level: accessLevelEnum("level").notNull().default("read"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("collection_access_unique").on(t.collectionId, t.userId),
    index("collection_access_user_idx").on(t.userId),
  ]
);

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull().unique(),
  keyHint: text("key_hint").default(""),
  label: text("label").default(""),
  enabled: boolean("enabled").notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const invitations = pgTable("invitations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull(),
  invitedBy: text("invited_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pins = pgTable(
  "pins",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: pinTargetTypeEnum("target_type").notNull(),
    targetPath: text("target_path").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("pins_user_path").on(t.userId, t.targetPath),
    index("pins_user_idx").on(t.userId),
  ]
);

// ---- Invite links (for collection sharing) ----

export const inviteLinks = pgTable(
  "invite_links",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    token: text("token").notNull().unique().$defaultFn(() => crypto.randomUUID()),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invite_links_collection").on(t.collectionId),
  ]
);

// ---- OAuth tables (for MCP) ----

export const oauthClients = pgTable("oauth_clients", {
  clientId: text("client_id").primaryKey(),
  clientSecret: text("client_secret"),
  clientName: text("client_name"),
  redirectUris: text("redirect_uris").notNull(), // JSON array
  grantTypes: text("grant_types"), // JSON array
  responseTypes: text("response_types"), // JSON array
  clientUri: text("client_uri"),
  logoUri: text("logo_uri"),
  scope: text("scope"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oauthCodes = pgTable("oauth_codes", {
  code: text("code").primaryKey(),
  clientId: text("client_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  scope: text("scope"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
});

// ---- Arti storage (self-built commit/weave layer, backed by Postgres) ----

export const artiCommits = pgTable(
  "arti_commits",
  {
    id: text("id").primaryKey(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    author: text("author").notNull(),
    message: text("message").notNull().default(""),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    seq: bigserial("seq", { mode: "number" }).notNull(),
  },
  (t) => [
    index("arti_commits_collection_seq").on(t.collectionId, t.seq.desc()),
    index("arti_commits_parent").on(t.parentId),
  ]
);

export const artiRefs = pgTable(
  "arti_refs",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    commitId: text("commit_id")
      .notNull()
      .references(() => artiCommits.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.name] })]
);

export const artiCommitFiles = pgTable(
  "arti_commit_files",
  {
    commitId: text("commit_id")
      .notNull()
      .references(() => artiCommits.id, { onDelete: "cascade" }),
    collectionId: text("collection_id").notNull(),
    path: text("path").notNull(),
    action: text("action").notNull(), // 'create' | 'update' | 'delete'
    diffText: text("diff_text").notNull().default(""), // unified diff for this file in this commit
    addedLines: integer("added_lines").notNull().default(0),
    removedLines: integer("removed_lines").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.commitId, t.path] }),
    index("arti_commit_files_col_path").on(t.collectionId, t.path, t.commitId),
  ]
);

export const artiWeaveOps = pgTable(
  "arti_weave_ops",
  {
    lineId: text("line_id").notNull(),
    commitId: text("commit_id")
      .notNull()
      .references(() => artiCommits.id, { onDelete: "cascade" }),
    collectionId: text("collection_id").notNull(),
    path: text("path").notNull(),
    opType: text("op_type").notNull(), // 'insert' | 'toggle'
    text: text("text"),
    depth: integer("depth"),
    anchoredRight: boolean("anchored_right"),
    insertSeq: bigint("insert_seq", { mode: "number" }),
  },
  (t) => [
    primaryKey({ columns: [t.lineId, t.commitId] }),
    index("arti_weave_ops_col_path_commit").on(t.collectionId, t.path, t.commitId),
    index("arti_weave_ops_line").on(t.lineId),
  ]
);

export const artiFileSnapshot = pgTable(
  "arti_file_snapshot",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: text("content").notNull(),
    weaveState: text("weave_state").notNull(), // JSON: [[lineId,text,depth,anchoredRight,count], ...] in weave order
    lineCount: integer("line_count").notNull(),
    lastCommitId: text("last_commit_id")
      .notNull()
      .references(() => artiCommits.id, { onDelete: "cascade" }),
    tsv: tsvector("tsv").generatedAlwaysAs(sql`to_tsvector('simple', "content")`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // non-null = tombstoned; weave kept for resurrect
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.path] }),
    index("arti_file_snapshot_tsv").using("gin", t.tsv),
    index("arti_file_snapshot_col_path_pattern").on(t.collectionId, t.path),
  ]
);
