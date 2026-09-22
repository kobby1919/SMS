export default function LoadingPaymentCorrections() {
  return (
    <main className="space-y-5 p-3 sm:p-5 lg:p-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="h-4 w-36 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 h-8 w-72 max-w-full animate-pulse rounded bg-slate-100" />
        <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded bg-slate-100" />
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-8">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </section>
      <section className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 2xl:flex-row">
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex gap-2">
                  <div className="h-7 w-28 animate-pulse rounded-full bg-slate-100" />
                  <div className="h-7 w-32 animate-pulse rounded-full bg-slate-100" />
                </div>
                <div className="h-6 w-80 max-w-full animate-pulse rounded bg-slate-100" />
                <div className="grid gap-3 lg:grid-cols-3">
                  <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
                  <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
                  <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
                </div>
              </div>
              <div className="h-56 w-full animate-pulse rounded-xl bg-slate-100 2xl:w-[430px]" />
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}