import { validateTarget } from "./fresh-install-safety.mjs";

const canonical = (host) => host.toLowerCase().replace("-pooler.", ".");

export function validateRestoreTarget({ url, branchId, stagingHost, productionHost }) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error("Missing or invalid private restored-branch URL."); }
  if (!/^br-[a-z0-9-]+$/.test(branchId ?? "")) throw new Error("Supply the restored branch ID, not a hostname or connection URL.");
  if (!/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(stagingHost ?? "") || canonical(parsed.hostname) === canonical(stagingHost)) throw new Error("The restore endpoint must differ from a valid pinned staging host.");
  const target = validateTarget({ environment: "staging", url, expectedHost: parsed.hostname, productionHost });
  parsed.searchParams.set("sslmode", "verify-full");
  return { ...target, environment: "isolated-restore", branchId, url: parsed.toString() };
}

// Exclude Prisma's own bookkeeping objects: the SQL baseline does not create them.
export const restoreCatalogQueries = {
  tables: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' ORDER BY tablename`,
  columns: `SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS required,pg_get_expr(d.adbin,d.adrelid) AS default_value
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname<>'_prisma_migrations' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attname`,
  // PostgreSQL 18 catalogs table NOT NULL constraints separately; column attnotnull covers their semantics.
  constraints: `SELECT c.relname,con.conname,con.contype,pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname<>'_prisma_migrations' AND con.contype IN ('p','f','u','c','x') ORDER BY c.relname,con.conname`,
  indexes: `SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename<>'_prisma_migrations' ORDER BY indexname`,
  enums: `SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
    JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder`,
};

export function assertCatalogMatches(actual, expected) {
  for (const name of Object.keys(restoreCatalogQueries)) {
    if (JSON.stringify(actual[name]) !== JSON.stringify(expected[name])) throw new Error(`Restored ${name} differ from the reviewed baseline.`);
  }
}
