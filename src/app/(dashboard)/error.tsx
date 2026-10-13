"use client";

import PageRecoveryError from "@/src/components/PageRecoveryError";

export default function DashboardError({ unstable_retry }: { unstable_retry: () => void }) {
  return <PageRecoveryError reset={unstable_retry} />;
}
