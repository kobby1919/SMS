"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Calendar, CheckCircle2, Loader2, Megaphone } from "lucide-react";
import { createAnnouncement, updateAnnouncement } from "@/src/lib/actions/actions";

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(140, "Keep the title short."),
  description: z.string().trim().min(1, "Message is required").max(2000, "Message is too long."),
  date: z.string().min(1, "Publish date is required"),
  classId: z.string().optional(),
  priority: z.enum(["NORMAL", "IMPORTANT", "URGENT"]),
  expiresAt: z.string().optional(),
}).refine((data) => {
  if (!data.expiresAt) return true;
  return new Date(data.expiresAt) >= new Date(data.date);
}, {
  message: "Expiry date must be on or after publish date.",
  path: ["expiresAt"],
});

type Inputs = z.infer<typeof schema>;

type ClassOption = {
  id: number;
  name: string;
};

type AnnouncementFormData = Partial<{
  id: number;
  title: string;
  description: string;
  date: string | Date;
  classId: number | null;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  expiresAt: string | Date | null;
}>;

const toDateInput = (value: string | Date | null | undefined) => {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
};

export default function AnnouncementForm({
  type,
  data,
  onSuccess,
}: {
  type: "create" | "update";
  data?: AnnouncementFormData;
  onSuccess?: () => void;
}) {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: data?.title ?? "",
      description: data?.description ?? "",
      date: toDateInput(data?.date) || new Date().toISOString().slice(0, 10),
      classId: data?.classId ? String(data.classId) : "",
      priority: data?.priority ?? "NORMAL",
      expiresAt: toDateInput(data?.expiresAt),
    },
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/form-data/classes")
      .then((response) => response.json())
      .then((rows: ClassOption[]) => {
        if (!cancelled) setClasses(rows);
      })
      .catch(() => {
        if (!cancelled) setApiError("Failed to load classes.");
      })
      .finally(() => {
        if (!cancelled) setLoadingClasses(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (values: Inputs) => {
    setSubmitting(true);
    setApiError(null);
    setSuccess(false);
    try {
      const payload = {
        ...(type === "update" && data?.id ? { id: data.id } : {}),
        title: values.title,
        description: values.description,
        date: new Date(values.date).toISOString(),
        classId: values.classId ? Number(values.classId) : null,
        priority: values.priority,
        expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
      };

      if (type === "create") await createAnnouncement(payload);
      else await updateAnnouncement(payload);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess?.();
      }, 900);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Could not save this notice.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
          <Megaphone size={18} />
        </div>
        <h1 className="mt-3 text-2xl font-black text-gray-900">
          {type === "create" ? "Publish Notice" : "Update Notice"}
        </h1>
        <p className="mt-1 text-sm font-semibold text-gray-400">
          Keep it short, clear, and targeted to the right audience.
        </p>
      </div>

      {apiError && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {apiError}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
          <CheckCircle2 size={15} />
          Notice saved successfully.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-black uppercase tracking-wide text-gray-500">Title</span>
          <input
            {...register("title")}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-violet-400"
            placeholder="e.g. PTA meeting this Friday"
          />
          {errors.title && <span className="text-xs font-semibold text-rose-600">{errors.title.message}</span>}
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-black uppercase tracking-wide text-gray-500">Message</span>
          <textarea
            {...register("description")}
            rows={5}
            className="resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-violet-400"
            placeholder="Write the exact notice parents and staff should see."
          />
          {errors.description && <span className="text-xs font-semibold text-rose-600">{errors.description.message}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-black uppercase tracking-wide text-gray-500">Audience</span>
          <select
            {...register("classId")}
            disabled={loadingClasses}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-violet-400 disabled:opacity-60"
          >
            <option value="">Whole school</option>
            {classes.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-black uppercase tracking-wide text-gray-500">Priority</span>
          <select
            {...register("priority")}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-violet-400"
          >
            <option value="NORMAL">Normal</option>
            <option value="IMPORTANT">Important</option>
            <option value="URGENT">Urgent</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-black uppercase tracking-wide text-gray-500">Publish Date</span>
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              {...register("date")}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pl-9 text-sm font-semibold outline-none transition focus:border-violet-400"
            />
          </div>
          {errors.date && <span className="text-xs font-semibold text-rose-600">{errors.date.message}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-black uppercase tracking-wide text-gray-500">Expiry Date</span>
          <input
            type="date"
            {...register("expiresAt")}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-violet-400"
          />
          {errors.expiresAt && <span className="text-xs font-semibold text-rose-600">{errors.expiresAt.message}</span>}
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-800 disabled:opacity-60"
      >
        {submitting && <Loader2 size={16} className="animate-spin" />}
        {submitting ? "Saving..." : type === "create" ? "Publish notice" : "Save notice"}
      </button>
    </form>
  );
}
