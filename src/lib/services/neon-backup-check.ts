import "server-only";
import { z } from "zod";

const id = z.string().regex(/^[a-z0-9-]{1,100}$/);
const endpointSchema = z.object({ endpoints: z.array(z.object({ branch_id: id, host: z.string().min(1) })) });
const snapshotSchema = z.object({ snapshots: z.array(z.object({
  id,
  source_branch_id: id,
  created_at: z.iso.datetime({ offset: true }),
  manual: z.boolean(),
  expires_at: z.iso.datetime({ offset: true }).nullish(),
  status: z.string().optional(),
})) });
const normalizeHost = (host: string) => host.toLowerCase().replace(/-pooler(?=\.)/, "");

export class NeonBackupCheckError extends Error {}

// Catalog inspection only. It must never create/restore/delete snapshots or branches.
export async function inspectNeonBackupCatalog() {
  const projectId = process.env.NEON_RECOVERY_PROJECT_ID;
  const branchId = process.env.NEON_RECOVERY_BRANCH_ID;
  const apiKey = process.env.NEON_RECOVERY_API_KEY;
  if (!id.safeParse(projectId).success || !id.safeParse(branchId).success || !apiKey?.trim()) {
    throw new NeonBackupCheckError("Neon catalog verification is not configured. The platform team can record independently verified recovery evidence using the manual controls below.");
  }
  let databaseHost: string;
  try { databaseHost = normalizeHost(new URL(process.env.DATABASE_URL ?? "").hostname); }
  catch { throw new NeonBackupCheckError("The deployment database identity could not be checked."); }
  async function get(resource: string): Promise<unknown> {
    try {
      const response = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}/${resource}`, {
        method: "GET", headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Provider unavailable");
      return await response.json();
    } catch {
      // Provider bodies and headers can contain sensitive operational information.
      throw new NeonBackupCheckError("Neon catalog verification is unavailable. No recovery readiness was changed. Retry later or use independently verified manual evidence.");
    }
  }
  const endpoints = endpointSchema.safeParse(await get(`branches/${branchId}/endpoints`));
  if (!endpoints.success || !endpoints.data.endpoints.some((endpoint) => endpoint.branch_id === branchId && normalizeHost(endpoint.host) === databaseHost)) {
    throw new NeonBackupCheckError("The configured Neon branch does not match this deployment's database host. No recovery readiness was changed.");
  }
  const catalog = snapshotSchema.safeParse(await get("snapshots"));
  if (!catalog.success) throw new NeonBackupCheckError("Neon returned an unrecognized snapshot catalog. No recovery readiness was changed.");
  const now = Date.now();
  const snapshots = catalog.data.snapshots.filter((snapshot) => snapshot.source_branch_id === branchId
    && Date.parse(snapshot.created_at) <= now
    && (!snapshot.expires_at || Date.parse(snapshot.expires_at) > now)
    && (!snapshot.status || ["ready", "available", "completed"].includes(snapshot.status.toLowerCase())))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const latest = snapshots[0];
  return {
    checkedAt: new Date(now).toISOString(),
    snapshotCount: snapshots.length,
    latest: latest ? { id: latest.id, createdAt: latest.created_at, scheduled: !latest.manual } : null,
  };
}
