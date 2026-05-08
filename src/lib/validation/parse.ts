import { NextResponse } from "next/server";
import { z } from "zod";

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): ParseResult<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Validation failed",
          issues: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: result.data };
}

export function parseSearchParams<T>(
  schema: z.ZodType<T>,
  params: URLSearchParams,
): ParseResult<T> {
  const raw = Object.fromEntries(params.entries());
  return parseBody(schema, raw);
}

/** Throw a plain Error for server actions (caught by action callers / toast). */
export function parseActionInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(first?.message ?? "Invalid input");
  }
  return result.data;
}
