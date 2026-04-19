/**
 * Run work after the HTTP response is sent.
 *
 * On Vercel, `waitUntil` keeps the function instance alive up to its
 * max duration so background work can finish. On a long-running Node
 * process (self-host, local dev) the process stays up on its own, so
 * a detached promise is enough. Errors are logged, never rethrown —
 * the response has already gone out.
 */
export function runAfterResponse(
  work: () => Promise<unknown>,
  label: string,
): void {
  const promise = work().catch((err) => {
    console.error(`[after-response] ${label} failed:`, err);
  });

  if (process.env.VERCEL) {
    import("@vercel/functions")
      .then(({ waitUntil }) => waitUntil(promise))
      .catch((err) => {
        console.error(
          "[after-response] @vercel/functions not available; " +
            "background task may be cut short when the function freezes:",
          err,
        );
      });
  }
}
