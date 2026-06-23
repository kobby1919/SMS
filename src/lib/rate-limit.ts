import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitRow = {
  count: number;
  resetAt: Date;
};

export class RateLimitExceededError extends Error {
  readonly resetAt: number;

  constructor(resetAt: number) {
    super("Too many requests. Please try again shortly.");
    this.name = "RateLimitExceededError";
    this.resetAt = resetAt;
  }
}

function clientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? req.headers.get("cf-connecting-ip") ?? "unknown";
}

export function rateLimitKey(req: NextRequest, scope: string, actorId?: string) {
  return `${scope}:${actorId ?? clientIp(req)}`;
}

/** Atomic PostgreSQL bucket shared by every application instance. */
export async function checkRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const nextReset = new Date(Date.now() + windowMs);
  const rows = await prisma.$queryRawUnsafe<RateLimitRow[]>(
    `INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
     VALUES ($1, 1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT ("key") DO UPDATE SET
       "count" = CASE
         WHEN "RateLimitBucket"."resetAt" <= CURRENT_TIMESTAMP THEN 1
         ELSE "RateLimitBucket"."count" + 1
       END,
       "resetAt" = CASE
         WHEN "RateLimitBucket"."resetAt" <= CURRENT_TIMESTAMP THEN EXCLUDED."resetAt"
         ELSE "RateLimitBucket"."resetAt"
       END,
       "updatedAt" = CURRENT_TIMESTAMP
     RETURNING "count", "resetAt"`,
    key,
    nextReset,
  );

  const row = rows[0];
  if (!row) throw new Error("Rate limit state could not be persisted.");
  const resetAt = new Date(row.resetAt).getTime();
  return {
    allowed: row.count <= limit,
    remaining: Math.max(limit - row.count, 0),
    resetAt,
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

export async function enforceRateLimit(
  req: NextRequest,
  options: Omit<RateLimitOptions, "key"> & { scope: string; actorId?: string },
) {
  const result = await checkRateLimit({
    key: rateLimitKey(req, options.scope, options.actorId),
    limit: options.limit,
    windowMs: options.windowMs,
  });
  return result.allowed ? null : rateLimitResponse(result.resetAt);
}

export async function enforceActionRateLimit(options: RateLimitOptions) {
  const result = await checkRateLimit(options);
  if (!result.allowed) throw new RateLimitExceededError(result.resetAt);
}
