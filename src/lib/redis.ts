import { Redis } from '@upstash/redis'

// Validate environment variables
const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN
const isRedisConfigured = Boolean(url && token && url.startsWith('https://'))

if (!isRedisConfigured) {
  console.warn('Upstash Redis credentials are not set. Caching will be disabled or fallback to direct queries.')
}

export const redis = new Redis({
  url: url || 'https://localhost',
  token: token || 'unconfigured',
})

/**
 * Helper to get or set a cached value from Redis.
 * Never re-runs `fetcher()` if `redis.set` fails or if `fetcher()` itself throws.
 */
export async function withCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  if (!isRedisConfigured) {
    return fetcher()
  }

  try {
    const cached = await redis.get<T>(key)
    if (cached !== null && cached !== undefined) {
      return cached
    }
  } catch (err) {
    console.error(`Redis cache read error for key ${key}:`, err)
  }

  const data = await fetcher()

  if (ttlSeconds > 0) {
    try {
      await redis.set(key, data, { ex: ttlSeconds })
    } catch (err) {
      console.error(`Redis cache write error for key ${key}:`, err)
    }
  }

  return data
}

