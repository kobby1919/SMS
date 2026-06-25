type RedisResponse<T> = {
  result?: T;
  error?: string;
};

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export function isRedisConfigured() {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

export async function redisCommand<T>(
  command: Array<string | number>,
): Promise<T | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;

  const response = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Redis command failed with status ${response.status}.`);
  }

  const results = await response.json() as Array<RedisResponse<T>>;
  const first = results[0];
  if (!first) return null;
  if (first.error) throw new Error(first.error);

  return first.result ?? null;
}
