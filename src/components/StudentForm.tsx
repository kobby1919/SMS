"use client";

// src/components/StudentForm.tsx

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import InputField from "./InputField";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ClassOption = { id: number; name: string; grade: { level: string } };
type ParentOption = { id: string; name: string; surname: string };

// ─── Schema ───────────────────────────────────────────────────────────────────
const createSchema = z.object({
  username:  z.string().min(3, "Too short!").max(20, "Too long!"),
  email:     z.string().email("Invalid email").optional().or(z.literal("")),
  password:  z.string().min(8, "At least 8 characters"),
  name:      z.string().min(1, "First name required"),
  surname:   z.string().min(1, "Last name required"),
  phone:     z.string().optional(),
  address:   z.string().min(1, "Address required"),
  bloodType: z.string().min(1, "Required"),
  birthday:  z.string().min(1, "Required"),
  sex:       z.enum(["MALE", "FEMALE"]),
  classId:   z.coerce.number().min(1, "Class is required"),
  parentId:  z.string().min(1, "Parent is required"),
  img:       z.any().optional(),
});

const updateSchema = z.object({
  name:      z.string().min(1, "First name required"),
  surname:   z.string().min(1, "Last name required"),
  phone:     z.string().optional(),
  address:   z.string().min(1, "Address required"),
  bloodType: z.string().min(1, "Required"),
  birthday:  z.string().optional(),
  sex:       z.enum(["MALE", "FEMALE"]),
  classId:   z.coerce.number().min(1, "Class is required"),
  parentId:  z.string().min(1, "Parent is required"),
  img:       z.any().optional(),
});

type CreateInputs = z.infer<typeof createSchema>;

// ─── Component ────────────────────────────────────────────────────────────────
const StudentForm = ({
  type,
  data,
  onSuccess,
}: {
  type:       "create" | "update";
  data?:      any;
  onSuccess?: () => void;
}) => {
  const [classes,   setClasses]   = useState<ClassOption[]>([]);
  const [parents,   setParents]   = useState<ParentOption[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [apiError,  setApiError]  = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);
  const [isPending, startTransition] = useTransition();

  const schema = type === "create" ? createSchema : updateSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateInputs>({
    resolver: zodResolver(schema) as any,
    defaultValues: data
      ? {
          name:      data.name      ?? "",
          surname:   data.surname   ?? "",
          phone:     data.phone     ?? "",
          address:   data.address   ?? "",
          bloodType: data.bloodType ?? "",
          sex:       data.sex       ?? "MALE",
          classId:   data.classId   ?? "",
          parentId:  data.parentId  ?? "",
        }
      : { sex: "MALE" },
  });

  // Load classes and parents
  useEffect(() => {
    Promise.all([
      fetch("/api/form-data/classes").then((r) => r.json()),
      fetch("/api/form-data/parents").then((r) => r.json()),
    ])
      .then(([c, p]) => { setClasses(c); setParents(p); })
      .catch(() => setApiError("Failed to load form data."))
      .finally(() => setLoading(false));
  }, []);

  const onSubmit = async (formData: CreateInputs): Promise<void> => {
    setApiError(null);
    startTransition(async () => {
      try {
        const url    = type === "create" ? "/api/students" : `/api/students/${data?.id}`;
        const method = type === "create" ? "POST" : "PUT";

        const body = new FormData();
        Object.entries(formData).forEach(([k, v]) => {
          if (v !== undefined && v !== null && k !== "img") {
            body.append(k, String(v));
          }
        });
        if (formData.img?.[0]) body.append("img", formData.img[0]);

        const res  = await fetch(url, { method, body });
        const json = await res.json();

        if (!res.ok) { setApiError(json.error ?? "Something went wrong."); return; }

        setSuccess(true);
        setTimeout(() => { setSuccess(false); onSuccess?.(); }, 1200);
      } catch {
        setApiError("Network error. Please try again.");
      }
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Loading form…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit as any)} className="flex flex-col gap-6">
      <h1 className="text-2xl font-black text-gray-800 tracking-tight">
        {type === "create" ? "Enrol New Student" : "Update Student"}
      </h1>

      {/* Feedback */}
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
            Student {type === "create" ? "enrolled" : "updated"} successfully!
          </p>
        </div>
      )}

      {/* ── Auth Info (create only) ── */}
      {type === "create" && (
        <div className="flex flex-col gap-4">
          <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Account Info</span>
          <div className="flex flex-wrap gap-4">
            <InputField label="Username" name="username" register={register} error={errors.username} />
            <InputField label="Email"    name="email"    type="email"    register={register} error={errors.email} />
            <InputField label="Password" name="password" type="password" register={register} error={errors.password} />
          </div>
        </div>
      )}

      {/* ── Personal Info ── */}
      <div className="flex flex-col gap-4">
        <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Personal Info</span>
        <div className="flex flex-wrap gap-4">
          <InputField label="First Name"  name="name"      register={register} error={errors.name} />
          <InputField label="Last Name"   name="surname"   register={register} error={errors.surname} />
          <InputField label="Phone"       name="phone"     register={register} error={errors.phone} />
          <InputField label="Address"     name="address"   register={register} error={errors.address} />
          <InputField label="Blood Type"  name="bloodType" register={register} error={errors.bloodType} />
          <InputField label="Birthday"    name="birthday"  type="date" register={register} error={errors.birthday} />

          {/* Sex */}
          <div className="flex flex-col gap-1 w-full md:w-[31%]">
            <label className="text-xs text-gray-500 font-semibold">Sex</label>
            <select
              {...register("sex")}
              className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none bg-white h-[42px]"
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
            {errors.sex && <p className="text-[10px] text-red-500 font-medium">{errors.sex.message}</p>}
          </div>

          {/* Photo */}
          <div className="flex flex-col gap-2 w-full md:w-[31%] justify-center">
            <label
              htmlFor="student-img"
              className="text-xs text-gray-500 font-semibold flex items-center gap-2 cursor-pointer border-2 border-dashed border-gray-200 p-2 rounded-xl hover:bg-gray-50 transition-colors h-[42px]"
            >
              <Upload size={16} className="text-gray-400" />
              <span className="text-gray-400 truncate">
                {type === "create" ? "Upload photo" : "Change photo"}
              </span>
            </label>
            <input type="file" id="student-img" accept="image/*" {...register("img")} className="hidden" />
          </div>
        </div>
      </div>

      {/* ── Enrollment Info ── */}
      <div className="flex flex-col gap-4">
        <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Enrollment</span>
        <div className="flex flex-wrap gap-4">

          {/* Class */}
          <div className="flex flex-col gap-1 w-full md:w-[48%]">
            <label className="text-xs text-gray-500 font-semibold">Class</label>
            <select
              {...register("classId")}
              className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none bg-white h-[42px]"
            >
              <option value="">Select class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.grade.level})
                </option>
              ))}
            </select>
            {errors.classId && <p className="text-[10px] text-red-500 font-medium">{errors.classId.message}</p>}
          </div>

          {/* Parent */}
          <div className="flex flex-col gap-1 w-full md:w-[48%]">
            <label className="text-xs text-gray-500 font-semibold">Parent / Guardian</label>
            <select
              {...register("parentId")}
              className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none bg-white h-[42px]"
            >
              <option value="">Select parent…</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.surname}
                </option>
              ))}
            </select>
            {errors.parentId && <p className="text-[10px] text-red-500 font-medium">{errors.parentId.message}</p>}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isPending && <Loader2 size={16} className="animate-spin" />}
        {isPending ? "Saving…" : type === "create" ? "Enrol Student" : "Update Student"}
      </button>
    </form>
  );
};

export default StudentForm;
