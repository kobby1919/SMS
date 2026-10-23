"use client";

import PageRecoveryError from "@/src/components/PageRecoveryError";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function DashboardError({ error, unstable_retry }: { error: unknown; unstable_retry: () => void }) {
  useEffect(() => { Sentry.captureException(error, { tags: { component: "dashboard-boundary" } }); }, [error]);
  return <PageRecoveryError reset={unstable_retry} />;
}
