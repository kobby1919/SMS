import { NextRequest, NextResponse } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

const buckets = new Map<string, RateLimitBucket>();

function clientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";

  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

export function rateLimitKey(req: NextRequest, scope: string, actorId?: string) {
  return `${scope}:${actorId ?? clientIp(req)}`;
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(limit - 1, 0), resetAt: now + windowMs };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return {
    allowed: true,
    remaining: Math.max(limit - current.count, 0),
    resetAt: current.resetAt,
  };
}

export function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1);

  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
      },
    },
  );
}

export function enforceRateLimit(
  req: NextRequest,
  options: Omit<RateLimitOptions, "key"> & { scope: string; actorId?: string },
) {
  const result = checkRateLimit({
    key: rateLimitKey(req, options.scope, options.actorId),
    limit: options.limit,
    windowMs: options.windowMs,
  });

  if (!result.allowed) return rateLimitResponse(result.resetAt);
  return null;
}
