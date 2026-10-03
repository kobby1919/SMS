export type SetupStageKey = "profile" | "path" | "fresh" | "migration" | "review" | "complete";

export const SETUP_STAGES: {
  key: SetupStageKey;
  label: string;
  href: string;
}[] = [
  { key: "profile", label: "School identity", href: "/onboarding/setup" },
  { key: "path", label: "Setup path", href: "/onboarding/setup/path" },
  { key: "fresh", label: "Fresh setup", href: "/onboarding/setup/fresh" },
  { key: "migration", label: "Data migration", href: "/onboarding/setup/migration" },
  { key: "review", label: "Readiness review", href: "/onboarding/setup/review" },
  { key: "complete", label: "Completion", href: "/onboarding/setup/complete" },
];

export function setupPathForStep(step?: string | null): string {
  if (step === "path") return "/onboarding/setup/path";
  if (step === "fresh") return "/onboarding/setup/fresh";
  if (step === "migration") return "/onboarding/setup/migration";
  if (step === "review") return "/onboarding/setup/review";
  if (step === "complete") return "/onboarding/setup/complete";
  return "/onboarding/setup";
}

export function setupStageNav(
  active: SetupStageKey,
  done: SetupStageKey[] = [],
  mode?: "fresh" | "migration",
) {
  return SETUP_STAGES.filter((stage) => {
    if (mode === "fresh") return stage.key !== "migration";
    if (mode === "migration") return stage.key !== "fresh";
    return true;
  }).map((stage) => ({
    ...stage,
    active: stage.key === active,
    done: done.includes(stage.key),
    locked: !done.includes(stage.key) && stage.key !== active,
  }));
}

