export type SetupStageKey = "profile" | "path" | "fresh" | "migration" | "review" | "complete";

export const SETUP_STAGES: {
  key: SetupStageKey;
  label: string;
  href: string;
}[] = [
  { key: "profile", label: "School identity", href: "/onboarding/setup" },
  { key: "path", label: "Setup path", href: "/onboarding/setup/path" },
  { key: "fresh", label: "Fresh setup", href: "/onboarding/setup/fresh" },
  { key: "migration", label: "Data migration", href: "/admin/data-migration" },
  { key: "review", label: "Readiness review", href: "/onboarding/setup/review" },
  { key: "complete", label: "Completion", href: "/onboarding/setup/complete" },
];

export function setupPathForStep(step?: string | null): string {
  if (step === "path") return "/onboarding/setup/path";
  if (step === "fresh") return "/onboarding/setup/fresh";
  if (step === "migration") return "/admin/data-migration";
  if (step === "review") return "/onboarding/setup/review";
  if (step === "complete") return "/onboarding/setup/complete";
  return "/onboarding/setup";
}

export function setupStageNav(active: SetupStageKey, done: SetupStageKey[] = []) {
  return SETUP_STAGES.map((stage) => ({
    ...stage,
    active: stage.key === active,
    done: done.includes(stage.key),
  }));
}

