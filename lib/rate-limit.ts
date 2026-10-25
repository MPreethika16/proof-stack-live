type Bucket = { timestamps: number[] };

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 8;
const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((time) => now - time < WINDOW_MS);
  if (bucket.timestamps.length >= MAX_REQUESTS) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return true;
}
