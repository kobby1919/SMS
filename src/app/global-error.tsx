"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import PageRecoveryError from "@/src/components/PageRecoveryError";

export default function GlobalError({ error, unstable_retry }: { error: unknown; unstable_retry: () => void }) {
  useEffect(() => { Sentry.captureException(error, { tags: { component: "global-boundary" } }); }, [error]);
  return <html lang="en"><body><PageRecoveryError reset={unstable_retry} /></body></html>;
}
