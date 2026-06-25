"use client";

// src/components/ParentForm.tsx

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useTransition } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import InputField from "./InputField";

// ─── Schema ───────────────────────────────────────────────────────────────────
const createSchema = z.object({
  username: z.string().min(3, "Too short!").max(20, "Too long!"),
  name:     z.string().min(1, "First name is required"),
  surname:  z.string().min(1, "Last name is required"),
  email:    z.string().email("Invalid email").optional().or(z.literal("")),
  phone:    z.string().min(1, "Phone is required"),
  address:  z.string().min(1, "Address is required"),
});

const updateSchema = createSchema.partial().extend({
  name:    z.string().min(1, "First name is required"),
  surname: z.string().min(1, "Last name is required"),
  address: z.string().min(1, "Address is required"),
});

type CreateInputs = z.infer<typeof createSchema>;
type ParentFormData = Partial<CreateInputs> & { id: string };

// ─── Component ────────────────────────────────────────────────────────────────
const ParentForm = ({
  type,
  data,
  onSuccess,
}: {
  type: "create" | "update";
  data?: ParentFormData;
  onSuccess?: () => void;
}) => {
  const [apiError,  setApiError]  = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);
  const [isPending, startTransition] = useTransition();

  const schema = type === "create" ? createSchema : updateSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateInputs>({
    resolver: zodResolver(schema) as Resolver<CreateInputs>,
    defaultValues: data
      ? {
          username: data.username ?? "",
          name:     data.name     ?? "",
          surname:  data.surname  ?? "",
          email:    data.email    ?? "",
          phone:    data.phone    ?? "",
          address:  data.address  ?? "",
        }
      : {},
  });

  const onSubmit = async (formData: CreateInputs): Promise<void> => {
    setApiError(null);
    startTransition(async () => {
      try {
        const url    = type === "create" ? "/api/parents" : `/api/parents/${data?.id}`;
        const method = type === "create" ? "POST" : "PUT";

        const res  = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <h1 className="text-2xl font-black text-gray-800 tracking-tight">
        {type === "create" ? "Add New Parent" : "Update Parent"}
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
            Parent {type === "create" ? "created" : "updated"} successfully!
          </p>
        </div>
      )}

      {/* ── Auth Info ── */}
      <div className="flex flex-col gap-4">
        <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">
          Account Info
        </span>
        <div className="flex flex-wrap gap-4">
          {type === "create" && (
            <InputField
              label="Username"
              name="username"
              register={register}
              error={errors.username}
            />
          )}
          <InputField
            label="Email"
            name="email"
            type="email"
            register={register}
            error={errors.email}
          />
          <InputField
            label="Phone"
            name="phone"
            register={register}
            error={errors.phone}
          />
        </div>
      </div>

      {/* ── Personal Info ── */}
      <div className="flex flex-col gap-4">
        <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">
          Personal Info
        </span>
        <div className="flex flex-wrap gap-4">
          <InputField
            label="First Name"
            name="name"
            register={register}
            error={errors.name}
          />
          <InputField
            label="Last Name"
            name="surname"
            register={register}
            error={errors.surname}
          />
          <div className="flex flex-col gap-1 w-full">
            <label className="text-xs text-gray-500 font-semibold">Address</label>
            <input
              {...register("address")}
              placeholder="e.g. Accra, Ghana"
              className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none transition-all"
            />
            {errors.address && (
              <p className="text-[10px] text-red-500 font-medium">
                {errors.address.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isPending && <Loader2 size={16} className="animate-spin" />}
        {isPending
          ? "Saving…"
          : type === "create"
          ? "Create Parent"
          : "Update Parent"}
      </button>
    </form>
  );
};

export default ParentForm;
