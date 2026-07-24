interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const entries = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;

export function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = entries.get(key);

  if (!entry || now > entry.resetAt) {
    entries.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetIn: WINDOW_MS };
  }

  entry.count += 1;

  if (entry.count > MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
  }

  return { allowed: true, remaining: MAX_REQUESTS - entry.count, resetIn: entry.resetAt - now };
}

export function cleanExpiredRateLimitEntries(): void {
  const now = Date.now();
  for (const [key, entry] of entries) {
    if (now > entry.resetAt) {
      entries.delete(key);
    }
  }
}