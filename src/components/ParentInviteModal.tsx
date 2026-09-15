"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Copy, Loader2, MailPlus, X } from "lucide-react";
import {
  createParentInviteAction,
  type ParentInviteCreateActionResult,
} from "@/src/lib/actions/parentInviteActions";

type StudentOption = {
  id: string;
  name: string;
  surname: string;
  className: string;
};

const initialForm = {
  name: "",
  surname: "",
  email: "",
  phone: "",
  studentIds: [] as string[],
};

export default function ParentInviteModal({ students }: { students: StudentOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [studentSearch, setStudentSearch] = useState("");
  const [result, setResult] = useState<ParentInviteCreateActionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return students.slice(0, 12);

    return students
      .filter((student) =>
        `${student.name} ${student.surname} ${student.className}`
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 20);
  }, [studentSearch, students]);

  function close() {
    setOpen(false);
    setResult(null);
    setCopied(false);
  }

  function updateField(field: keyof Omit<typeof form, "studentIds">, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleStudent(studentId: string) {
    setForm((current) => ({
      ...current,
      studentIds: current.studentIds.includes(studentId)
        ? current.studentIds.filter((id) => id !== studentId)
        : [...current.studentIds, studentId],
    }));
  }

  function submitInvite() {
    setResult(null);
    setCopied(false);

    startTransition(async () => {
      const response = await createParentInviteAction(form);
      setResult(response);

      if (response.ok) {
        setForm(initialForm);
        setStudentSearch("");
        router.refresh();
      }
    });
  }

  async function copyInviteLink(inviteUrl: string) {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const inviteUrl = result?.ok ? result.invite.inviteUrl : null;
  const selectedStudents = students.filter((student) => form.studentIds.includes(student.id));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 rounded-xl bg-edujay-primary px-4 py-2 text-sm font-black text-white shadow-sm shadow-blue-100 transition hover:bg-edujay-primaryDark active:scale-95"
      >
        <MailPlus size={18} strokeWidth={3} />
        <span className="hidden sm:inline">Invite parent</span>
        <span className="sm:hidden">Invite</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-gray-900/60 p-3 py-6 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="relative w-full max-w-[760px] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <button
              type="button"
              onClick={close}
              className="absolute right-3 top-3 z-10 rounded-lg bg-white/90 p-2 text-gray-400 shadow-sm ring-1 ring-gray-100 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close invite form"
            >
              <X size={20} />
            </button>

            <div className="max-h-[calc(100dvh-3rem)] overflow-y-auto p-4 pt-12 sm:p-8 sm:pt-8">
              <div className="mb-6">
                <p className="text-xs font-black uppercase tracking-widest text-edujay-primary">
                  Parent onboarding
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-900">
                  Invite parent
                </h2>
                <p className="mt-2 text-sm font-medium leading-6 text-gray-500">
                  Create a secure invite and connect the parent to the right ward.
                  The parent must accept with this same email before Edujay grants access.
                </p>
              </div>

              {result && !result.ok && (
                <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                  {result.message}
                </div>
              )}

              {inviteUrl && (
                <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 text-emerald-600" size={18} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-emerald-800">
                        Parent invite created
                      </p>
                      <p className="mt-1 text-xs font-semibold text-emerald-700">
                        Send this link to the parent. Edujay will only link the account
                        after the invited email accepts it.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 rounded-xl bg-white p-3 sm:flex-row sm:items-center">
                    <code className="min-w-0 flex-1 overflow-x-auto text-xs font-semibold text-gray-600">
                      {inviteUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyInviteLink(inviteUrl)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-950 px-3 py-2 text-xs font-black text-white"
                    >
                      <Copy size={14} />
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="First name"
                  value={form.name}
                  onChange={(value) => updateField("name", value)}
                  placeholder="Ama"
                />
                <Input
                  label="Surname"
                  value={form.surname}
                  onChange={(value) => updateField("surname", value)}
                  placeholder="Owusu"
                />
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(value) => updateField("email", value)}
                  placeholder="parent@email.com"
                />
                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={(value) => updateField("phone", value)}
                  placeholder="0240000000"
                />
              </div>

              <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-gray-500">
                      Link ward access
                    </p>
                    <p className="text-sm font-semibold text-gray-500">
                      Select every child this parent should be allowed to view.
                    </p>
                  </div>
                  <p className="text-xs font-black text-edujay-primary">
                    {form.studentIds.length} selected
                  </p>
                </div>
                <input
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Search student or class..."
                  className="mt-3 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 outline-none transition placeholder:text-gray-300 focus:border-edujay-primary focus:ring-2 focus:ring-edujay-ring"
                />
                <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
                  {filteredStudents.map((student) => {
                    const checked = form.studentIds.includes(student.id);
                    return (
                      <label
                        key={student.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${
                          checked
                            ? "border-edujay-primary bg-blue-50 text-edujay-primary"
                            : "border-gray-100 bg-white text-gray-600 hover:border-gray-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStudent(student.id)}
                          className="h-4 w-4 accent-edujay-primary"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-black">
                            {student.name} {student.surname}
                          </span>
                          <span className="block truncate text-xs font-semibold opacity-70">
                            {student.className}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  {filteredStudents.length === 0 && (
                    <p className="rounded-xl bg-white p-3 text-sm font-semibold text-gray-400 sm:col-span-2">
                      No students match this search.
                    </p>
                  )}
                </div>
                {selectedStudents.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedStudents.map((student) => (
                      <span
                        key={student.id}
                        className="rounded-full bg-white px-3 py-1 text-xs font-black text-gray-500 ring-1 ring-gray-100"
                      >
                        {student.name} {student.surname}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={close}
                  disabled={isPending}
                  className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-black text-gray-600 transition hover:bg-gray-200 disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={submitInvite}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-edujay-primary px-4 py-2.5 text-sm font-black text-white transition hover:bg-edujay-primaryDark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending && <Loader2 size={16} className="animate-spin" />}
                  {isPending ? "Creating invite..." : "Create invite"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-black uppercase tracking-wide text-gray-500">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-700 outline-none transition placeholder:text-gray-300 focus:border-edujay-primary focus:ring-2 focus:ring-edujay-ring"
      />
    </div>
  );
}