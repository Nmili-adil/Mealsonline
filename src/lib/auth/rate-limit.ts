import "server-only";

/**
 * Lightweight sliding-window rate limiter for authentication endpoints.
 *
 * Sufficient for single-instance deployments. When running multiple
 * server/worker processes behind a load balancer, replace this store with a
 * durable shared store (Redis/PostgreSQL) — see docs/SECURITY.md.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60 * 1000;

export function rateLimit(key: string, limit: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** For tests: clear the in-memory store. */
export function resetRateLimitStore(): void {
  buckets.clear();
}
