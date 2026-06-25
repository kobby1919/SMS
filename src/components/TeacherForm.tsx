"use client";

// src/components/TeacherForm.tsx

import { useEffect, useState, useTransition } from "react";
import { useForm, type Resolver, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import InputField from "./InputField";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

// ─── Schema ───────────────────────────────────────────────────────────────────
const createSchema = z.object({
  username:  z.string().min(3, "Too short!").max(20, "Too long!"),
  email:     z.string().email("Invalid email!"),
  password:  z.string().min(8, "At least 8 characters"),
  name:      z.string().min(1, "First name required"),
  surname:   z.string().min(1, "Last name required"),
  phone:     z.string().min(1, "Phone required"),
  address:   z.string().min(1, "Address required"),
  bloodType: z.string().min(1, "Required"),
  birthday:  z.string().min(1, "Required"),
  sex:       z.enum(["MALE", "FEMALE"]),
  img:       z.custom<FileList>().optional(),
});

const updateSchema = z.object({
  name:      z.string().min(1, "First name required"),
  surname:   z.string().min(1, "Last name required"),
  phone:     z.string().optional(),
  address:   z.string().min(1, "Address required"),
  bloodType: z.string().min(1, "Required"),
  birthday:  z.string().optional(),
  sex:       z.enum(["MALE", "FEMALE"]),
  img:       z.custom<FileList>().optional(),
});

type CreateInputs = z.infer<typeof createSchema>;
type Subject = { id: number; name: string };
type TeacherFormData = Partial<CreateInputs> & { id: string; subjects?: Subject[] };

// ─── Component ────────────────────────────────────────────────────────────────
const TeacherForm = ({
  type,
  data,
  onSuccess,
}: {
  type:       "create" | "update";
  data?:      TeacherFormData;
  onSuccess?: () => void;
}) => {
  const [subjects,    setSubjects]    = useState<Subject[]>([]);
  const [selectedSubs, setSelectedSubs] = useState<number[]>(
    data?.subjects?.map((s: Subject) => s.id) ?? []
  );
  const [apiError,    setApiError]    = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);
  const [isPending,   startTransition] = useTransition();

  const schema = type === "create" ? createSchema : updateSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateInputs>({
    resolver: zodResolver(schema) as Resolver<CreateInputs>,
    defaultValues: data
      ? {
          name:      data.name      ?? "",
          surname:   data.surname   ?? "",
          phone:     data.phone     ?? "",
          address:   data.address   ?? "",
          bloodType: data.bloodType ?? "",
          sex:       data.sex       ?? "MALE",
        }
      : { sex: "MALE" },
  });

  // Load subjects for assignment
  useEffect(() => {
    fetch("/api/form-data/subjects")
      .then((r) => r.json())
      .then(setSubjects)
      .catch(() => {});
  }, []);

  const toggleSubject = (id: number) => {
    setSelectedSubs((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 5
        ? prev  // max 5 subjects
        : [...prev, id]
    );
  };

  const onSubmit = async (formData: CreateInputs): Promise<void> => {
    setApiError(null);
    startTransition(async () => {
      try {
        const url    = type === "create" ? "/api/teachers" : `/api/teachers/${data?.id}`;
        const method = type === "create" ? "POST" : "PUT";

        const body = new FormData();
        Object.entries(formData).forEach(([k, v]) => {
          if (v !== undefined && v !== null && k !== "img") {
            body.append(k, String(v));
          }
        });
        // Attach file if provided
        if (formData.img?.[0]) body.append("img", formData.img[0]);
        body.append("subjectIds", JSON.stringify(selectedSubs));

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

  return (
    <form onSubmit={handleSubmit(onSubmit as SubmitHandler<CreateInputs>)} className="flex flex-col gap-6">
      <h1 className="text-2xl font-black text-gray-800 tracking-tight">
        {type === "create" ? "Create New Teacher" : "Update Teacher"}
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
            Teacher {type === "create" ? "created" : "updated"} successfully!
          </p>
        </div>
      )}

      {/* ── Auth Info (create only) ── */}
      {type === "create" && (
        <div className="flex flex-col gap-4">
          <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">
            Account Info
          </span>
          <div className="flex flex-wrap gap-4">
            <InputField label="Username"  name="username" register={register} error={errors.username} />
            <InputField label="Email"     name="email"    type="email"    register={register} error={errors.email} />
            <InputField label="Password"  name="password" type="password" register={register} error={errors.password} />
          </div>
        </div>
      )}

      {/* ── Personal Info ── */}
      <div className="flex flex-col gap-4">
        <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">
          Personal Info
        </span>
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

          {/* Photo upload */}
          <div className="flex flex-col gap-2 w-full md:w-[31%] justify-center">
            <label
              htmlFor="teacher-img"
              className="text-xs text-gray-500 font-semibold flex items-center gap-2 cursor-pointer border-2 border-dashed border-gray-200 p-2 rounded-xl hover:bg-gray-50 transition-colors h-[42px]"
            >
              <Upload size={16} className="text-gray-400" />
              <span className="text-gray-400 truncate">
                {type === "create" ? "Upload photo" : "Change photo"}
              </span>
            </label>
            <input type="file" id="teacher-img" accept="image/*" {...register("img")} className="hidden" />
          </div>
        </div>
      </div>

      {/* ── Subject Assignment ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">
            Subjects
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
            ${selectedSubs.length >= 5 ? "bg-rose-50 text-rose-600" : "bg-gray-100 text-gray-400"}`}>
            {selectedSubs.length}/5
          </span>
        </div>
        <div className="max-h-[180px] overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-50">
          {subjects.map((s) => {
            const isSel   = selectedSubs.includes(s.id);
            const atLimit = !isSel && selectedSubs.length >= 5;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSubject(s.id)}
                disabled={atLimit}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors
                  ${isSel ? "bg-indigo-50 text-indigo-700" : atLimit ? "opacity-40 cursor-not-allowed bg-white" : "bg-white hover:bg-gray-50 text-gray-700"}`}
              >
                <span className="text-sm font-semibold">{s.name}</span>
                {isSel && <CheckCircle2 size={14} className="text-indigo-500 shrink-0" />}
              </button>
            );
          })}
        </div>
        {selectedSubs.length >= 5 && (
          <p className="text-[10px] text-rose-500 font-semibold">Max 5 subjects per teacher.</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isPending && <Loader2 size={16} className="animate-spin" />}
        {isPending ? "Saving…" : type === "create" ? "Create Teacher" : "Update Teacher"}
      </button>
    </form>
  );
};

export default TeacherForm;
