import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { CollectionRef, FileRef, RealtimeAdapter, Unsubscribe } from "@openarti/shared";

interface CollectionSubscription {
  channel: RealtimeChannel | null;
  commitListeners: Set<() => void>;
  fileListeners: Map<string, Set<() => void>>;
  collectionIdPromise: Promise<string | null>;
}

export interface SupabaseAdapterOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiUrl: string;
}

/**
 * Realtime via Supabase Broadcast (public channels).
 *
 * Subscribes to channel `collection:{collectionId}`. API server publishes
 * `{ event: 'change', payload: { paths: string[] } }` after every write.
 * Adapter fires commit listeners on every event; fires file listeners whose
 * path appears in payload.paths.
 *
 * No RLS / JWT required — channel is public, messages carry only paths (no
 * file content). Unauthorized clients who guess a collectionId see only
 * "activity happened" metadata; any actual read goes back through the API.
 */
export class SupabaseAdapter implements RealtimeAdapter {
  private readonly client: SupabaseClient;
  private readonly apiUrl: string;
  private readonly subs = new Map<string, CollectionSubscription>();

  constructor(opts: SupabaseAdapterOptions) {
    this.client = createClient(opts.supabaseUrl, opts.supabaseAnonKey);
    this.apiUrl = opts.apiUrl;
  }

  subscribeCollection(ref: CollectionRef, onChange: () => void): Unsubscribe {
    const sub = this.getOrCreate(ref);
    sub.commitListeners.add(onChange);
    return () => {
      const s = this.subs.get(this.key(ref));
      if (!s) return;
      s.commitListeners.delete(onChange);
      this.cleanupIfIdle(ref);
    };
  }

  subscribeFile(ref: FileRef, onChange: () => void): Unsubscribe {
    const sub = this.getOrCreate(ref);
    let set = sub.fileListeners.get(ref.path);
    if (!set) {
      set = new Set();
      sub.fileListeners.set(ref.path, set);
    }
    set.add(onChange);
    return () => {
      const s = this.subs.get(this.key(ref));
      if (!s) return;
      const set = s.fileListeners.get(ref.path);
      if (!set) return;
      set.delete(onChange);
      if (set.size === 0) s.fileListeners.delete(ref.path);
      this.cleanupIfIdle(ref);
    };
  }

  private key(ref: CollectionRef): string {
    return `${ref.owner}/${ref.name}`;
  }

  private getOrCreate(ref: CollectionRef): CollectionSubscription {
    const key = this.key(ref);
    const existing = this.subs.get(key);
    if (existing) return existing;

    const sub: CollectionSubscription = {
      channel: null,
      commitListeners: new Set(),
      fileListeners: new Map(),
      collectionIdPromise: this.resolveCollectionId(ref),
    };
    this.subs.set(key, sub);

    sub.collectionIdPromise.then((collectionId) => {
      if (!collectionId) return;
      if (!this.subs.has(key)) return; // unsubscribed before resolve

      const channel = this.client.channel(`collection:${collectionId}`);
      sub.channel = channel;

      channel
        .on("broadcast", { event: "change" }, (message) => {
          const current = this.subs.get(key);
          if (!current) return;
          const payload = (message.payload ?? {}) as { paths?: string[] };
          const paths = Array.isArray(payload.paths) ? payload.paths : [];

          for (const fn of current.commitListeners) fn();
          for (const path of paths) {
            const set = current.fileListeners.get(path);
            if (set) for (const fn of set) fn();
          }
        })
        .subscribe();
    });

    return sub;
  }

  private async resolveCollectionId(ref: CollectionRef): Promise<string | null> {
    try {
      const res = await fetch(
        `${this.apiUrl}/collections/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.name)}`,
        { credentials: "include" }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { id: string };
      return data.id ?? null;
    } catch {
      return null;
    }
  }

  private cleanupIfIdle(ref: CollectionRef) {
    const key = this.key(ref);
    const s = this.subs.get(key);
    if (!s) return;
    if (s.commitListeners.size === 0 && s.fileListeners.size === 0) {
      if (s.channel) s.channel.unsubscribe();
      this.subs.delete(key);
    }
  }
}
