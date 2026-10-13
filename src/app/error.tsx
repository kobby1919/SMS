"use client";

import PageRecoveryError from "@/src/components/PageRecoveryError";

export default function ErrorPage({ unstable_retry }: { unstable_retry: () => void }) {
  return <PageRecoveryError reset={unstable_retry} />;
}
