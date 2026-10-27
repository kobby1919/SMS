import "server-only";

const restoreHost = "ep-blue-sound-ba4q8i6i.c-8.eu-central-1.aws.neon.tech";
const settings = ["DATABASE_URL", "DIRECT_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING"] as const;
type Comparison = "MATCH" | "DIFFERENT" | "UNKNOWN" | "NOT_CONFIGURED";

function compareConnection(value: string | undefined): Comparison {
  if (!value) return "NOT_CONFIGURED";
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) return "UNKNOWN";
    // node-postgres allows a query-string host to override the URI hostname.
    const overrides = url.searchParams.getAll("host");
    const host = (overrides.at(-1) || decodeURIComponent(url.hostname)).toLowerCase().replace(/\.$/, "").replace(/-pooler(?=\.)/, "");
    if (host === restoreHost) return "MATCH";
    // Proxies, custom domains and multi-host settings cannot prove a different branch.
    if (!/^ep-[a-z0-9-]+(?:\.[a-z0-9-]+)+\.neon\.tech$/.test(host)) return "UNKNOWN";
    return "DIFFERENT";
  } catch {
    // Never return or log a parsing exception: it can contain the secret input.
    return "UNKNOWN";
  }
}

export function getRestoreBranchConnectionDiagnostic(env: NodeJS.ProcessEnv = process.env) {
  const environment = ["production", "preview", "development"].includes(env.VERCEL_ENV ?? "") ? env.VERCEL_ENV! : "Local / unverified environment";
  const commit = /^[a-f0-9]{40}$/i.test(env.VERCEL_GIT_COMMIT_SHA ?? "") ? env.VERCEL_GIT_COMMIT_SHA!.slice(0, 7) : "Unavailable";
  const deployment = /^(?=.{1,253}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(env.VERCEL_URL ?? "") ? env.VERCEL_URL! : "Unavailable";
  return {
    target: "October 23 restore-test branch",
    environment,
    commit,
    deployment,
    checkedAt: new Date().toISOString(),
    connections: settings.map((setting) => ({ setting, runtime: setting === "DATABASE_URL", comparison: compareConnection(env[setting]) })),
  };
}
