import type { CollectionRef, FileRef, RealtimeAdapter, Unsubscribe } from "@openarti/shared";

interface SubscriptionState {
  listeners: Set<() => void>;
  lastCommitId: string | null | undefined; // undefined = no fetch yet
  timer: ReturnType<typeof setInterval> | null;
}

export interface PollingAdapterOptions {
  apiUrl: string;
  intervalMs?: number;
}

export class PollingAdapter implements RealtimeAdapter {
  private readonly apiUrl: string;
  private readonly intervalMs: number;
  private readonly subs = new Map<string, SubscriptionState>();

  constructor(opts: PollingAdapterOptions) {
    this.apiUrl = opts.apiUrl;
    this.intervalMs = opts.intervalMs ?? 5000;
  }

  subscribeCollection(ref: CollectionRef, onChange: () => void): Unsubscribe {
    const key = `c:${ref.owner}/${ref.name}`;
    const url = `${this.apiUrl}/collections/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.name)}/head`;
    return this.register(key, url, onChange);
  }

  subscribeFile(ref: FileRef, onChange: () => void): Unsubscribe {
    const key = `f:${ref.owner}/${ref.name}:${ref.path}`;
    const url = `${this.apiUrl}/collections/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.name)}/head?path=${encodeURIComponent(ref.path)}`;
    return this.register(key, url, onChange);
  }

  private register(key: string, url: string, onChange: () => void): Unsubscribe {
    let state = this.subs.get(key);
    if (!state) {
      state = { listeners: new Set(), lastCommitId: undefined, timer: null };
      this.subs.set(key, state);
      this.startLoop(key, url, state);
    }
    state.listeners.add(onChange);

    return () => {
      const s = this.subs.get(key);
      if (!s) return;
      s.listeners.delete(onChange);
      if (s.listeners.size === 0) {
        if (s.timer) clearInterval(s.timer);
        this.subs.delete(key);
      }
    };
  }

  private startLoop(key: string, url: string, state: SubscriptionState) {
    const tick = async () => {
      const current = this.subs.get(key);
      if (!current) return;
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          // 404 on a file that used to exist = treat as change
          if (res.status === 404 && current.lastCommitId !== undefined && current.lastCommitId !== null) {
            current.lastCommitId = null;
            for (const fn of current.listeners) fn();
          }
          return;
        }
        const data = (await res.json()) as { commitId: string | null };
        const seen = data.commitId ?? null;
        if (current.lastCommitId === undefined) {
          current.lastCommitId = seen;
          return;
        }
        if (current.lastCommitId !== seen) {
          current.lastCommitId = seen;
          for (const fn of current.listeners) fn();
        }
      } catch {
        // transient network error — swallow, retry next tick
      }
    };

    // prime commitId immediately so later ticks have a baseline; don't fire onChange
    tick();
    state.timer = setInterval(tick, this.intervalMs);
  }
}
