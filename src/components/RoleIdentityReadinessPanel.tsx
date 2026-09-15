import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  ShieldCheck,
} from "lucide-react";
import type {
  RoleIdentityReadiness,
  TestIdentityPlanItem,
} from "@/src/lib/services/role-identity-readiness";

export default function RoleIdentityReadinessPanel({
  readiness,
}: {
  readiness: RoleIdentityReadiness;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">
            Point 2
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-gray-950">
            Production-style test identities
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-gray-500">
            Default-school can stay as our test tenant, but every login should
            behave like a real person: one Clerk account, one role, one school.
            This panel flags old shared IDs/emails before we use the invite flows.
          </p>
        </div>

        <div
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black ${
            readiness.healthy
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {readiness.healthy ? <ShieldCheck size={16} /> : <CircleAlert size={16} />}
          {readiness.healthy ? "No critical conflicts" : "Conflicts need cleanup"}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Count label="Admins" value={readiness.counts.admins} />
        <Count label="Teachers" value={readiness.counts.teachers} />
        <Count label="Parents" value={readiness.counts.parents} />
        <Count label="Students" value={readiness.counts.students} />
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-5">
        {readiness.testPlan.map((item) => (
          <PlanCard key={item.role} item={item} />
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-gray-950">Identity audit</h3>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-gray-500">
            {readiness.issues.length} issue{readiness.issues.length === 1 ? "" : "s"}
          </span>
        </div>

        {readiness.issues.length === 0 ? (
          <p className="mt-3 text-sm font-medium leading-6 text-gray-500">
            No role identity overlaps were found for {readiness.schoolId}.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {readiness.issues.map((issue) => (
              <div
                key={`${issue.title}:${issue.affected.join("|")}`}
                className="rounded-xl border border-white bg-white p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p
                    className={`text-sm font-black ${
                      issue.severity === "critical"
                        ? "text-rose-700"
                        : "text-amber-700"
                    }`}
                  >
                    {issue.title}
                  </p>
                  <span
                    className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${
                      issue.severity === "critical"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {issue.severity}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium leading-6 text-gray-500">
                  {issue.detail}
                </p>
                <ul className="mt-3 space-y-1">
                  {issue.affected.map((item) => (
                    <li
                      key={item}
                      className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <p className="text-2xl font-black leading-none text-gray-950">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-gray-400">
        {label}
      </p>
    </div>
  );
}

function PlanCard({ item }: { item: TestIdentityPlanItem }) {
  const Icon = item.status === "planned" ? CircleDashed : CheckCircle2;

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-black text-gray-950">{item.title}</h3>
        <Icon
          size={16}
          className={item.status === "planned" ? "text-amber-500" : "text-emerald-600"}
        />
      </div>
      <p className="mt-3 text-xs font-bold text-gray-500">{item.recommendedEmail}</p>
      <p className="mt-3 text-xs font-medium leading-5 text-gray-500">
        {item.accountRule}
      </p>
      <p className="mt-2 text-[11px] font-bold leading-5 text-gray-400">
        {item.inviteFlow}
      </p>
    </div>
  );
}
