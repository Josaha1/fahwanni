/** Keep error reports small and remove common personal data before writing to logs. */
export function sanitizeErrorMessage(message: string): string {
  return message.slice(0, 300)
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email]")
    .replace(/\d+\.\d{3,}/g, "#")
    .replace(/\b\d{7,}\b/g, "#");
}

/** Fixed one-minute windows, scoped to the process and keyed only by IP hash. */
export function createErrorRateLimiter(limit = 10, windowMs = 60_000) {
  const attempts = new Map<string, { start: number; count: number }>();
  return (key: string, now: number): boolean => {
    const current = attempts.get(key);
    if (!current || now - current.start >= windowMs) {
      attempts.set(key, { start: now, count: 1 });
      for (const [otherKey, entry] of attempts) {
        if (now - entry.start >= windowMs) attempts.delete(otherKey);
      }
      return true;
    }
    if (current.count >= limit) return false;
    current.count++;
    return true;
  };
}
