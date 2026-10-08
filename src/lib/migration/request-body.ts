import { MigrationStagingError } from "@/src/lib/migration/staging";

export async function readMigrationJson(request: Request, limit: number) {
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") throw new MigrationStagingError("Cross-site migration requests are not allowed.", 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new MigrationStagingError("Use a JSON request.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new MigrationStagingError("Missing request body.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new MigrationStagingError("The upload is too large. Split the file before uploading.", 413); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
