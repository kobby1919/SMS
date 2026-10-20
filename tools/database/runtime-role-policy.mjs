export const runtimeRole = "edujay_app";
export const createRuntimeRoleSql = `CREATE ROLE edujay_app LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`;
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';

export function buildRuntimeGrants(tables) {
  if (!tables.length || tables.includes("_prisma_migrations") || new Set(tables).size !== tables.length ||
      tables.some((table) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(table))) {
    throw new Error("Runtime grants require a reviewed application-table allowlist.");
  }
  return [
    // PUBLIC privileges are inherited even by NOINHERIT roles; close those DDL routes.
    "REVOKE CREATE ON SCHEMA public FROM PUBLIC",
    "REVOKE CREATE, TEMPORARY ON DATABASE neondb FROM PUBLIC",
    "REVOKE ALL ON TABLE public._prisma_migrations FROM PUBLIC, edujay_app",
    "GRANT CONNECT ON DATABASE neondb TO edujay_app",
    "GRANT USAGE ON SCHEMA public TO edujay_app",
    ...tables.map((table) => `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.${quote(table)} TO edujay_app`),
    "GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO edujay_app",
    "ALTER ROLE edujay_app IN DATABASE neondb SET search_path TO pg_catalog, public",
  ].join(";\n") + ";";
}

export function assertRuntimeAttributes(role, memberships, ownsObjects) {
  if (!role || !role.rolcanlogin || role.rolsuper || role.rolcreatedb || role.rolcreaterole ||
      role.rolreplication || role.rolbypassrls || role.rolinherit || memberships || ownsObjects) {
    throw new Error("Runtime role has unexpected administrative, inherited or owner privileges.");
  }
}

export function runtimeConnectionUrls(ownerUrl, password) {
  const direct = new URL(ownerUrl);
  if (!password || direct.hostname.includes("-pooler.")) throw new Error("A direct endpoint and private runtime password are required.");
  direct.username = runtimeRole;
  direct.password = password;
  direct.searchParams.set("sslmode", "verify-full");
  const pooled = new URL(direct);
  const firstDot = pooled.hostname.indexOf(".");
  pooled.hostname = pooled.hostname.slice(0, firstDot) + "-pooler" + pooled.hostname.slice(firstDot);
  return { direct: direct.toString(), pooled: pooled.toString() };
}
