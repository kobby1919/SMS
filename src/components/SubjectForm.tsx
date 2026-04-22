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
type Teacher = { id: string; name: string; surname: string };

const SubjectForm = ({
  type, data, onSuccess,
}: {
  type: "create" | "update";
  data?: any;
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
        : prev.length >= 5
        ? prev // max 5 teachers per subject
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
        await updateSubject(data.id, { name: formData.name, teacherIds: selected });
      }
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onSuccess?.(); }, 1200);
    } catch (e: any) {
      setApiError(e?.message ?? "Something went wrong.");
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

      {/* Teacher assignment */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-500 font-semibold">
            Assigned Teachers
          </label>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
            ${selected.length >= 5
              ? "bg-rose-50 text-rose-600"
              : "bg-gray-100 text-gray-400"}`}>
            {selected.length}/5
          </span>
        </div>

        {/* Selected teacher pills */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 p-2 bg-indigo-50 rounded-xl border border-indigo-100">
            {selected.map((id) => {
              const t = teachers.find((t) => t.id === id);
              if (!t) return null;
              return (
                <span
                  key={id}
                  className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 bg-indigo-600 text-white rounded-lg"
                >
                  {t.name} {t.surname}
                  <button type="button" onClick={() => toggleTeacher(id)}>
                    <X size={10} />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Teacher list */}
        <div className="max-h-[200px] overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-50">
          {teachers.map((t) => {
            const isSelected = selected.includes(t.id);
            const atLimit    = !isSelected && selected.length >= 5;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTeacher(t.id)}
                disabled={atLimit}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors
                  ${isSelected
                    ? "bg-indigo-50 text-indigo-700"
                    : atLimit
                    ? "opacity-40 cursor-not-allowed bg-white"
                    : "bg-white hover:bg-gray-50 text-gray-700"}`}
              >
                <span className="text-sm font-semibold">{t.name} {t.surname}</span>
                {isSelected && (
                  <CheckCircle2 size={14} className="text-indigo-500 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
        {selected.length >= 5 && (
          <p className="text-[10px] text-rose-500 font-semibold">
            Maximum 5 teachers per subject reached.
          </p>
        )}
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
