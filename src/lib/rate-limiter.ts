const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests = 120,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const current = rateLimitStore.get(key);
  if (!current || now > current.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  if (current.count > maxRequests) {
    return false;
  }
  return true;
}

