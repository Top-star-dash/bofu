type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * 进程内滑动窗口计数。pm2 单实例部署足够；
 * 多实例时需要换成 Redis 之类的共享存储。
 */
export function hitLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { blocked: false, remaining: limit - 1, retryAfterSec: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      blocked: true,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return {
    blocked: false,
    remaining: limit - bucket.count,
    retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

export function resetLimit(key: string) {
  buckets.delete(key);
}

/** 定期清理过期桶，避免长时间运行后 Map 膨胀 */
export function sweepLimits() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}
