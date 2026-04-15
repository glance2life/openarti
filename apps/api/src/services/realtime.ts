const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;

/**
 * Publish a "something changed" message on a collection's realtime channel.
 * Payload carries only paths — no content — so unauthorized subscribers leak
 * at most "collection X had activity at time T for these paths", not file data.
 * No-ops when SUPABASE_URL / SUPABASE_ANON_KEY are not configured (self-hosted
 * deployments rely on polling instead).
 */
export async function notifyCollection(
  collectionId: string,
  paths: string[]
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `collection:${collectionId}`,
            event: "change",
            payload: { paths },
            private: false,
          },
        ],
      }),
    });
  } catch {
    // realtime failure must not break writes
  }
}
