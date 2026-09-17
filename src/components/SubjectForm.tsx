"use client";

// src/components/SubjectForm.tsx

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { createSubject, updateSubject } from "@/src/lib/actions/actions";

const schema = z.object({
  name: z.string().min(1, "Subject name is required"),
});

type Inputs  = z.infer<typeof schema>;
type SubjectFormData = Partial<Inputs> & { id: number; teachers?: Teacher[] };
type Teacher = { id: string; name: string; surname: string };

const SubjectForm = ({
  type, data, onSuccess,
}: {
  type: "create" | "update";
  data?: SubjectFormData;
  onSuccess?: () => void;
}) => {
  const [teachers,    setTeachers]    = useState<Teacher[]>([]);
  const [selected,    setSelected]    = useState<string[]>(
    data?.teachers?.map((t: Teacher) => t.id) ?? []
  );
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [apiError,    setApiError]    = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<Inputs>({
    resolver: zodResolver(schema),
    defaultValues: { name: data?.name ?? "" },
  });

  useEffect(() => {
    fetch("/api/form-data/teachers")
      .then((r) => r.json())
      .then((t) => setTeachers(t))
      .catch(() => setApiError("Failed to load teachers."))
      .finally(() => setLoading(false));
  }, []);

  const toggleTeacher = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const onSubmit = async (formData: Inputs) => {
    setApiError(null);
    setSubmitting(true);
    try {
      if (type === "create") {
        await createSubject({ name: formData.name, teacherIds: selected });
      } else {
        if (!data) throw new Error("Subject data is required for an update.");
        await updateSubject(data.id, { name: formData.name, teacherIds: selected });
      }
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onSuccess?.(); }, 1200);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Loading…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <h1 className="text-2xl font-black text-gray-800 tracking-tight">
        {type === "create" ? "Add New Subject" : "Update Subject"}
      </h1>

      {apiError && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-rose-700">{apiError}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 size={15} className="text-emerald-500" />
          <p className="text-xs font-semibold text-emerald-700">
            Subject {type === "create" ? "created" : "updated"} successfully!
          </p>
        </div>
      )}

      {/* Subject name */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-semibold">Subject Name</label>
        <input
          {...register("name")}
          placeholder="e.g. Core Mathematics, Ghanaian Language"
          className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none transition-all"
        />
        {errors.name && <p className="text-[10px] text-red-500 font-medium">{errors.name.message}</p>}
      </div>

      {/* Subject capability */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs font-black uppercase tracking-wide text-gray-500">
            Teachers allowed to teach this subject
          </label>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
            {selected.length} selected
          </span>
        </div>

        <p className="text-xs font-semibold text-gray-400">
          This is subject capability. Timetable assignment happens separately and can only use teachers selected here.
        </p>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 p-2">
            {selected.map((id) => {
              const t = teachers.find((teacher) => teacher.id === id);
              if (!t) return null;
              return (
                <span
                  key={id}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white"
                >
                  {t.name} {t.surname}
                  <button type="button" onClick={() => toggleTeacher(id)} aria-label={`Remove ${t.name} ${t.surname}`}>
                    <X size={10} />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <div className="max-h-[220px] overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
          {teachers.map((t) => {
            const isSelected = selected.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTeacher(t.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                  isSelected
                    ? "bg-indigo-50 text-indigo-700"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="text-sm font-semibold">{t.name} {t.surname}</span>
                {isSelected && <CheckCircle2 size={14} className="shrink-0 text-indigo-500" />}
              </button>
            );
          })}
          {teachers.length === 0 && (
            <div className="px-4 py-6 text-center text-xs font-semibold text-gray-400">
              No active teachers are available. Invite and activate teachers first.
            </div>
          )}
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 size={16} className="animate-spin" />}
        {submitting ? "Saving…" : type === "create" ? "Create Subject" : "Update Subject"}
      </button>
    </form>
  );
};

export default SubjectForm;



