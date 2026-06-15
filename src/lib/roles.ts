export type AppRole = "admin" | "teacher" | "student" | "parent" | "bursar";

const APP_ROLES: AppRole[] = ["admin", "teacher", "student", "parent", "bursar"];

export function isAppRole(role: string | undefined): role is AppRole {
  return APP_ROLES.includes(role as AppRole);
}

/** Accept Clerk metadata values like "Teacher" or " teacher ". */
export function normalizeAppRole(role: unknown): AppRole | undefined {
  if (typeof role !== "string") return undefined;
  const normalized = role.trim().toLowerCase();
  return isAppRole(normalized) ? normalized : undefined;
}

/** Read role from JWT session claims (supports multiple Clerk claim shapes). */
export function roleFromSessionClaims(sessionClaims: unknown): AppRole | undefined {
  if (!sessionClaims || typeof sessionClaims !== "object") return undefined;

  const claims = sessionClaims as Record<string, unknown>;
  const metadata = claims.metadata as Record<string, unknown> | undefined;
  const publicMetadata = claims.publicMetadata as Record<string, unknown> | undefined;
  const public_metadata = claims.public_metadata as Record<string, unknown> | undefined;
  const privateMetadata = claims.privateMetadata as Record<string, unknown> | undefined;
  const private_metadata = claims.private_metadata as Record<string, unknown> | undefined;
  const unsafeMetadata = claims.unsafeMetadata as Record<string, unknown> | undefined;
  const unsafe_metadata = claims.unsafe_metadata as Record<string, unknown> | undefined;

  const role =
    claims.role ??
    claims.appRole ??
    claims.app_role ??
    metadata?.role ??
    metadata?.appRole ??
    metadata?.app_role ??
    publicMetadata?.role ??
    publicMetadata?.appRole ??
    publicMetadata?.app_role ??
    public_metadata?.role ??
    public_metadata?.appRole ??
    public_metadata?.app_role ??
    privateMetadata?.role ??
    private_metadata?.role ??
    unsafeMetadata?.role ??
    unsafe_metadata?.role;

  return normalizeAppRole(role);
}

export function dashboardPathForRole(role: AppRole): string {
  return `/${role}`;
}
