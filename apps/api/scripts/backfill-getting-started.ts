import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../src/db/index.js";
import { populateGettingStartedCollection } from "../src/services/template.js";

async function main() {
  const collections = await db
    .select({ id: schema.collections.id, ownerId: schema.collections.ownerId })
    .from(schema.collections)
    .where(eq(schema.collections.name, "getting-started"));

  for (const c of collections) {
    const snaps = await db
      .select({ path: schema.artiFileSnapshot.path })
      .from(schema.artiFileSnapshot)
      .where(
        and(
          eq(schema.artiFileSnapshot.collectionId, c.id),
          isNull(schema.artiFileSnapshot.deletedAt),
        ),
      );
    if (snaps.length > 0) {
      console.log(`skip ${c.id} (${snaps.length} files)`);
      continue;
    }
    console.log(`populating ${c.id} (owner=${c.ownerId})`);
    await populateGettingStartedCollection(c.id);
  }
  console.log("done");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
