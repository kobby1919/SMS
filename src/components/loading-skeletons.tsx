import type { PropsWithChildren } from "react";

type SkeletonBlockProps = {
  className?: string;
};

function SkeletonBlock({ className = "" }: SkeletonBlockProps) {
  return <div className={`animate-pulse rounded-xl bg-gray-200/80 ${className}`} />;
}

function SkeletonCard({
  children,
  className = "",
}: PropsWithChildren<SkeletonBlockProps>) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function DashboardPageSkeleton({
  title = "Loading page",
  variant = "dashboard",
}: {
  title?: string;
  variant?: "dashboard" | "table" | "report";
}) {
  if (variant === "report") {
    return <ReportPageSkeleton title={title} />;
  }

  return (
    <main className="m-2 mt-0 flex min-w-0 flex-1 flex-col gap-4 sm:m-4 sm:mt-0">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400">{title}</p>
            <SkeletonBlock className="mt-2 h-7 w-56 max-w-full" />
          </div>
          <SkeletonBlock className="h-10 w-full sm:w-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <SkeletonCard key={item}>
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="mt-3 h-8 w-20" />
            <SkeletonBlock className="mt-3 h-3 w-full" />
          </SkeletonCard>
        ))}
      </div>

      {variant === "table" ? (
        <SkeletonCard>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SkeletonBlock className="h-10 w-full sm:w-72" />
            <SkeletonBlock className="h-10 w-full sm:w-36" />
          </div>
          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 p-3 sm:grid-cols-4"
              >
                <SkeletonBlock className="h-5 w-full" />
                <SkeletonBlock className="h-5 w-3/4" />
                <SkeletonBlock className="h-5 w-2/3" />
                <SkeletonBlock className="h-5 w-1/2" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <SkeletonCard className="xl:col-span-2">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="mt-4 h-56 w-full" />
          </SkeletonCard>
          <SkeletonCard>
            <SkeletonBlock className="h-5 w-36" />
            <div className="mt-4 space-y-3">
              {[0, 1, 2, 3].map((item) => (
                <SkeletonBlock key={item} className="h-14 w-full" />
              ))}
            </div>
          </SkeletonCard>
        </div>
      )}
    </main>
  );
}

export function ReportPageSkeleton({
  title = "Loading report card",
}: {
  title?: string;
}) {
  return (
    <main className="m-2 mt-0 flex min-w-0 flex-1 flex-col gap-4 sm:m-4 sm:mt-0">
      <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SkeletonBlock className="h-5 w-44" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SkeletonBlock className="h-9 w-full sm:w-28" />
            <SkeletonBlock className="h-9 w-full sm:w-44" />
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="bg-gray-900 p-5 sm:p-8">
          <p className="text-xs font-bold text-white/50">{title}</p>
          <SkeletonBlock className="mt-3 h-9 w-72 max-w-full bg-white/20" />
          <SkeletonBlock className="mt-3 h-4 w-44 bg-white/20" />
        </div>
        <div className="space-y-5 p-4 sm:p-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SkeletonBlock className="h-24 w-full" />
            <SkeletonBlock className="h-24 w-full" />
          </div>
          <SkeletonBlock className="h-14 w-full" />
          <div className="grid gap-3 lg:hidden">
            {[0, 1, 2].map((item) => (
              <SkeletonBlock key={item} className="h-40 w-full" />
            ))}
          </div>
          <div className="hidden space-y-3 lg:block">
            {[0, 1, 2, 3, 4].map((item) => (
              <SkeletonBlock key={item} className="h-12 w-full" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <SkeletonBlock key={item} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
