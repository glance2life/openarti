import { config } from "dotenv";

const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
config({ path: envFile });
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

// Transaction-mode poolers (Supabase 6543, PgBouncer) don't support prepared
// statements. Auto-detect common hints; override explicitly via PG_PREPARE=false.
const looksLikePooler =
  /:6543(\/|\?|$)/.test(connectionString) ||
  /pooler\./.test(connectionString) ||
  /pgbouncer=true/i.test(connectionString);
const prepare = process.env.PG_PREPARE
  ? process.env.PG_PREPARE !== "false"
  : !looksLikePooler;

const client = postgres(connectionString, { prepare });
export const db = drizzle(client, { schema });
export { schema };
