"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Link2, Loader2, XCircle } from "lucide-react";
import {
  addParentWardLinkAction,
  updateParentWardLinkStatusAction,
  type ParentRelationshipActionResult,
} from "@/src/lib/actions/parentRelationshipActions";

type StudentOption = {
  id: string;
  name: string;
  surname: string;
  className: string;
};

type WardRelationship = {
  id: string;
  status: string;
  role: string;
  canViewFees: boolean;
  canViewReports: boolean;
  canMessageSchool: boolean;
  note: string | null;
  endedAt: Date | null;
  student: {
    id: string;
    name: string;
    surname: string;
    class: { name: string } | null;
  };
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "REMOVED", label: "Removed" },
  { value: "REVOKED", label: "Revoked" },
  { value: "TRANSFERRED", label: "Transferred" },
  { value: "GRADUATED", label: "Graduated" },
];

const ROLE_OPTIONS = [
  { value: "PRIMARY_GUARDIAN", label: "Primary guardian" },
  { value: "GUARDIAN", label: "Guardian" },
  { value: "EMERGENCY_CONTACT", label: "Emergency contact" },
  { value: "FINANCE_CONTACT", label: "Finance contact" },
  { value: "PICKUP_AUTHORIZED", label: "Pickup authorized" },
];

function statusClass(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 ring-emerald-100";
    case "REVOKED":
      return "bg-rose-50 text-rose-700 ring-rose-100";
    case "TRANSFERRED":
      return "bg-sky-50 text-sky-700 ring-sky-100";
    case "GRADUATED":
      return "bg-violet-50 text-violet-700 ring-violet-100";
    default:
      return "bg-slate-50 text-slate-600 ring-slate-100";
  }
}

function readable(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function ResultMessage({ result }: { result: ParentRelationshipActionResult | null }) {
  if (!result) return null;
  const Icon = result.ok ? CheckCircle2 : XCircle;
  return (
    <p className={`flex items-start gap-1.5 text-xs font-semibold ${result.ok ? "text-emerald-700" : "text-rose-700"}`}>
      <Icon size={14} className="mt-0.5 shrink-0" />
      {result.message}
    </p>
  );
}

export default function ParentWardLinkManager({
  parentId,
  relationships,
  students,
}: {
  parentId: string;
  relationships: WardRelationship[];
  students: StudentOption[];
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ParentRelationshipActionResult | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const linkedStudentIds = useMemo(() => new Set(relationships.map((relationship) => relationship.student.id)), [relationships]);
  const availableStudents = students.filter((student) => !linkedStudentIds.has(student.id));

  function submitAdd(formData: FormData) {
    setResult(null);
    setPendingKey("add");
    startTransition(async () => {
      const response = await addParentWardLinkAction({
        parentId,
        studentId: String(formData.get("studentId") ?? ""),
        role: String(formData.get("role") ?? "PRIMARY_GUARDIAN"),
        canViewFees: formData.get("canViewFees") === "on",
        canViewReports: formData.get("canViewReports") === "on",
        canMessageSchool: formData.get("canMessageSchool") === "on",
        note: String(formData.get("note") ?? ""),
      });
      setResult(response);
      setPendingKey(null);
    });
  }

  function submitStatus(formData: FormData) {
    const relationshipId = String(formData.get("relationshipId") ?? "");
    setResult(null);
    setPendingKey(relationshipId);
    startTransition(async () => {
      const response = await updateParentWardLinkStatusAction({
        relationshipId,
        status: String(formData.get("status") ?? ""),
        note: String(formData.get("note") ?? ""),
      });
      setResult(response);
      setPendingKey(null);
    });
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-100 transition hover:bg-slate-100"
      >
        <Link2 size={14} />
        {open ? "Close" : "Manage wards"}
      </button>

      {open && (
        <div className="mt-3 w-full rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left">
          <div className="space-y-3">
            {relationships.length > 0 ? (
              relationships.map((relationship) => (
                <form key={relationship.id} action={submitStatus} className="rounded-xl bg-white p-3 ring-1 ring-slate-100">
                  <input type="hidden" name="relationshipId" value={relationship.id} />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">
                        {relationship.student.name} {relationship.student.surname}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">
                        {relationship.student.class?.name ?? "No class"} - {readable(relationship.role)}
                      </p>
                    </div>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${statusClass(relationship.status)}`}>
                      {readable(relationship.status)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-end">
                    <label className="text-xs font-bold text-slate-500">
                      Status
                      <select
                        name="status"
                        defaultValue={relationship.status}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-edujay-primary"
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-slate-500">
                      Reason or note
                      <input
                        name="note"
                        defaultValue={relationship.note ?? ""}
                        placeholder="e.g. transferred to another school"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-edujay-primary"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                    >
                      {pendingKey === relationship.id ? <Loader2 size={14} className="animate-spin" /> : null}
                      Save
                    </button>
                  </div>
                </form>
              ))
            ) : (
              <p className="rounded-xl bg-white px-3 py-4 text-sm font-semibold text-slate-500 ring-1 ring-slate-100">
                No ward links yet. Add the first child below.
              </p>
            )}
          </div>

          <form action={submitAdd} className="mt-3 rounded-xl bg-white p-3 ring-1 ring-slate-100">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Add another ward</p>
            <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_180px]">
              <select
                name="studentId"
                required
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-edujay-primary"
                defaultValue=""
              >
                <option value="" disabled>Select ward</option>
                {availableStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} {student.surname} - {student.className}
                  </option>
                ))}
              </select>
              <select
                name="role"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-edujay-primary"
                defaultValue="PRIMARY_GUARDIAN"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {[
                ["canViewFees", "Fees"],
                ["canViewReports", "Reports"],
                ["canMessageSchool", "Messaging"],
              ].map(([name, label]) => (
                <label key={name} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-600">
                  <input type="checkbox" name={name} defaultChecked className="h-4 w-4 rounded border-slate-300" />
                  {label}
                </label>
              ))}
            </div>
            <input
              name="note"
              placeholder="Optional note"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-edujay-primary"
            />
            <button
              type="submit"
              disabled={isPending || availableStudents.length === 0}
              className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-edujay-primary px-3 py-2 text-xs font-black text-white disabled:opacity-60"
            >
              {pendingKey === "add" ? <Loader2 size={14} className="animate-spin" /> : null}
              Add ward link
            </button>
          </form>

          <div className="mt-3">
            <ResultMessage result={result} />
          </div>
        </div>
      )}
    </div>
  );
}
