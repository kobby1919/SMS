"use client";

// src/components/StudentForm.tsx

import { useEffect, useState, useTransition } from "react";
import { useForm, type Resolver, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import InputField from "./InputField";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ClassOption = { id: number; name: string; grade: { level: string } };
type ParentOption = { id: string; name: string; surname: string };

// ─── Schema ───────────────────────────────────────────────────────────────────
const createSchema = z.object({
  admissionNumber: z.string().trim().min(2, "Admission number is required").max(40, "Too long"),
  email:     z.string().email("Invalid email").optional().or(z.literal("")),
  name:      z.string().min(1, "First name required"),
  surname:   z.string().min(1, "Last name required"),
  phone:     z.string().optional(),
  address:   z.string().min(1, "Address required"),
  bloodType: z.string().min(1, "Required"),
  birthday:  z.string().min(1, "Required"),
  sex:       z.enum(["MALE", "FEMALE"]),
  status:    z.enum(["INCOMPLETE_SETUP", "ACTIVE", "TRANSFERRED", "GRADUATED", "WITHDRAWN"]).default("ACTIVE"),
  classId:   z.coerce.number().min(1, "Class is required"),
  parentId:  z.string().optional(),
  parentName: z.string().optional(),
  parentSurname: z.string().optional(),
  parentEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  parentPhone: z.string().optional(),
  img:       z.custom<FileList>().optional(),
}).superRefine((value, ctx) => {
  if (value.parentId) return;

  if (!value.parentName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["parentName"],
      message: "Guardian first name is required",
    });
  }

  if (!value.parentSurname?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["parentSurname"],
      message: "Guardian last name is required",
    });
  }

  if (!value.parentEmail?.trim() && !value.parentPhone?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["parentEmail"],
      message: "Provide guardian email or phone",
    });
  }
});

const updateSchema = z.object({
  admissionNumber: z.string().trim().min(2, "Admission number is required").max(40, "Too long"),
  name:      z.string().min(1, "First name required"),
  surname:   z.string().min(1, "Last name required"),
  phone:     z.string().optional(),
  address:   z.string().min(1, "Address required"),
  bloodType: z.string().min(1, "Required"),
  birthday:  z.string().optional(),
  sex:       z.enum(["MALE", "FEMALE"]),
  status:    z.enum(["INCOMPLETE_SETUP", "ACTIVE", "TRANSFERRED", "GRADUATED", "WITHDRAWN"]).default("ACTIVE"),
  classId:   z.coerce.number().min(1, "Class is required"),
  parentId:  z.string().min(1, "Parent is required"),
  img:       z.custom<FileList>().optional(),
});

type CreateInputs = z.infer<typeof createSchema>;
type StudentFormData = Partial<CreateInputs> & { id: string };

// ─── Component ────────────────────────────────────────────────────────────────
const StudentForm = ({
  type,
  data,
  onSuccess,
}: {
  type:       "create" | "update";
  data?:      StudentFormData;
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
    watch,
    formState: { errors },
  } = useForm<CreateInputs>({
    resolver: zodResolver(schema) as Resolver<CreateInputs>,
    defaultValues: data
      ? {
          admissionNumber: data.admissionNumber ?? "",
          name:      data.name      ?? "",
          surname:   data.surname   ?? "",
          phone:     data.phone     ?? "",
          address:   data.address   ?? "",
          bloodType: data.bloodType ?? "",
          sex:       data.sex       ?? "MALE",
          status:    data.status    ?? "ACTIVE",
          classId:   data.classId,
          parentId:  data.parentId  ?? "",
        }
      : { sex: "MALE" },
  });
  const selectedParentId = watch("parentId");

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
    <form onSubmit={handleSubmit(onSubmit as SubmitHandler<CreateInputs>)} className="flex flex-col gap-6">
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

      {/* ── Personal Info ── */}
      <div className="flex flex-col gap-4">
        <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Personal Info</span>
        <div className="flex flex-wrap gap-4">
          <InputField label="Admission Number" name="admissionNumber" register={register} error={errors.admissionNumber} />
          {type === "create" && <InputField label="Email (optional)" name="email" type="email" register={register} error={errors.email} />}
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

          {type === "update" && (
            <div className="flex flex-col gap-1 w-full md:w-[31%]">
              <label className="text-xs text-gray-500 font-semibold">Student Status</label>
              <select
                {...register("status")}
                className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none bg-white h-[42px]"
              >
                <option value="INCOMPLETE_SETUP">Incomplete setup</option>
                <option value="ACTIVE">Active</option>
                <option value="TRANSFERRED">Transferred</option>
                <option value="GRADUATED">Graduated</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </select>
              {errors.status && <p className="text-[10px] text-red-500 font-medium">{errors.status.message}</p>}
            </div>
          )}

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

          {type === "create" && (
            <div className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="mb-3">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Smart Parent Linking</p>
                <p className="mt-1 text-xs text-gray-500">
                  Select an existing parent above, or leave it blank and Edujay will match by email/phone or create the parent profile.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <InputField
                  label="Guardian First Name"
                  name="parentName"
                  register={register}
                  error={errors.parentName}
                  inputProps={{ disabled: Boolean(selectedParentId) }}
                />
                <InputField
                  label="Guardian Last Name"
                  name="parentSurname"
                  register={register}
                  error={errors.parentSurname}
                  inputProps={{ disabled: Boolean(selectedParentId) }}
                />
                <InputField
                  label="Guardian Email"
                  name="parentEmail"
                  type="email"
                  register={register}
                  error={errors.parentEmail}
                  inputProps={{ disabled: Boolean(selectedParentId) }}
                />
                <InputField
                  label="Guardian Phone"
                  name="parentPhone"
                  register={register}
                  error={errors.parentPhone}
                  inputProps={{ disabled: Boolean(selectedParentId) }}
                />
              </div>
            </div>
          )}
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
