export function isSerializationConflict(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  if (error.code === "P2034") return true;
  if (error.code !== "P2010" || !("meta" in error) || !error.meta || typeof error.meta !== "object") return false;
  const meta = error.meta as { code?: unknown; driverAdapterError?: { cause?: { originalCode?: unknown } } };
  const code = meta.driverAdapterError?.cause?.originalCode ?? meta.code;
  return code === "40001" || code === "40P01";
}
