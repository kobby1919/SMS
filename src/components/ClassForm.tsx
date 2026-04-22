"use client";

// src/components/ClassForm.tsx

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { createClass, updateClass } from "@/src/lib/actions/actions";

const schema = z.object({
  name: z.string().min(1, "Class name is required"),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1"),
  gradeId: z.coerce.number().min(1, "Grade is required"),
  section: z.string().optional(),
  supervisorId: z.string().optional(),
});

type Inputs = z.infer<typeof schema>;

type Grade = { id: number; level: string; order: number };
type Teacher = { id: string; name: string; surname: string };

const ClassForm = ({
  type,
  data,
  onSuccess,
}: {
  type: "create" | "update";
  data?: any;
  onSuccess?: () => void;
}) => {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>({
    resolver: zodResolver(schema) as any,
    defaultValues: data
      ? {
          name: data.name ?? "",
          capacity: data.capacity ?? 30,
          gradeId: data.gradeId ?? "",
          section: data.section ?? "",
          supervisorId: data.supervisorId ?? "",
        }
      : { capacity: 30, section: "" },
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [gradeRes, teacherRes] = await Promise.all([
          fetch("/api/form-data/grades"),
          fetch("/api/form-data/teachers"),
        ]);
        const [g, t] = await Promise.all([gradeRes.json(), teacherRes.json()]);
        setGrades(g);
        setTeachers(t);
      } catch {
        setApiError("Failed to load form data.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const onSubmit = async (formData: Inputs): Promise<void> => {
    setApiError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        capacity: formData.capacity,
        gradeId: formData.gradeId,
        section: formData.section || undefined,
        supervisorId: formData.supervisorId || undefined,
      };
      if (type === "create") {
        await createClass(payload);
      } else {
        await updateClass(data.id, payload);
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess?.();
      }, 1200);
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
        <p className="text-sm text-gray-400 font-medium">Loading form data…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <h1 className="text-2xl font-black text-gray-800 tracking-tight">
        {type === "create" ? "Add New Class" : "Update Class"}
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
            Class {type === "create" ? "created" : "updated"} successfully!
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        {/* Class name */}
        <div className="flex flex-col gap-1 w-full md:w-[48%]">
          <label className="text-xs text-gray-500 font-semibold">
            Class Name
          </label>
          <input
            {...register("name")}
            placeholder="e.g. Class 3A, JHS 2B"
            className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none transition-all"
          />
          {errors.name && (
            <p className="text-[10px] text-red-500 font-medium">
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Capacity */}
        <div className="flex flex-col gap-1 w-full md:w-[48%]">
          <label className="text-xs text-gray-500 font-semibold">
            Capacity
          </label>
          <input
            type="number"
            {...register("capacity")}
            className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none transition-all"
          />
          {errors.capacity && (
            <p className="text-[10px] text-red-500 font-medium">
              {errors.capacity.message}
            </p>
          )}
        </div>

        {/* Grade */}
        <div className="flex flex-col gap-1 w-full md:w-[48%]">
          <label className="text-xs text-gray-500 font-semibold">
            Grade / Level
          </label>
          <select
            {...register("gradeId")}
            className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none bg-white h-[42px]"
          >
            <option value="">Select grade…</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.level}
              </option>
            ))}
          </select>
          {errors.gradeId && (
            <p className="text-[10px] text-red-500 font-medium">
              {errors.gradeId.message}
            </p>
          )}
        </div>

        {/* Section */}
        <div className="flex flex-col gap-1 w-full md:w-[48%]">
          <label className="text-xs text-gray-500 font-semibold">
            Section{" "}
            <span className="text-gray-300 font-normal">
              (optional — A or B)
            </span>
          </label>
          <select
            {...register("section")}
            className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none bg-white h-[42px]"
          >
            <option value="">No section</option>
            <option value="A">A</option>
            <option value="B">B</option>
          </select>
        </div>

        {/* Supervisor */}
        <div className="flex flex-col gap-1 w-full">
          <label className="text-xs text-gray-500 font-semibold">
            Class Supervisor{" "}
            <span className="text-gray-300 font-normal">(optional)</span>
          </label>
          <select
            {...register("supervisorId")}
            className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none bg-white h-[42px]"
          >
            <option value="">No supervisor assigned</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.surname}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 size={16} className="animate-spin" />}
        {submitting
          ? "Saving…"
          : type === "create"
            ? "Create Class"
            : "Update Class"}
      </button>
    </form>
  );
};

export default ClassForm;
