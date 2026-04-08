"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import z from "zod";
import InputField from "./InputField";
import { Upload } from "lucide-react"; // Import a nice upload icon

const schema = z.object({
  username: z.string().min(3, "Too short!").max(20, "Too long!"),
  email: z.string().email("Invalid email!"),
  password: z.string().min(8, "Too short!"),
  firstName: z.string().min(1, "Required!"),
  lastName: z.string().min(1, "Required!"),
  phone: z.string().min(1, "Required!"),
  address: z.string().min(1, "Required!"),
  bloodType: z.string().min(1, "Required!"),
  birthday: z.string().min(1, "Required!"),
  sex: z.enum(["male", "female"]),
  img: z.any().refine((files) => files?.length == 1, "Image is required!"), // Zod check for file
});

type Inputs = z.infer<typeof schema>;

const TeacherForm = ({
  type,
  data,
}: {
  type: "create" | "update";
  data?: any;
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>({
    resolver: zodResolver(schema),
    defaultValues: data,
  });

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={handleSubmit((d) => console.log(d))}
    >
      <h1 className="text-2xl font-black text-gray-800 tracking-tight">
        {type === "create" ? "Create a New Teacher" : "Update Teacher"}
      </h1>

      {/* --- Authentication Info --- */}
      <div className="flex flex-wrap justify-between gap-4">
        <span className="w-full text-xs text-gray-400 font-bold uppercase tracking-widest">
          Authentication Info
        </span>
        <InputField
          label="Username"
          name="username"
          register={register}
          error={errors.username}
        />
        <InputField
          label="Email"
          name="email"
          type="email"
          register={register}
          error={errors.email}
        />
        <InputField
          label="Password"
          name="password"
          type="password"
          register={register}
          error={errors.password}
        />
      </div>

      {/* --- Personal Info --- */}
      <div className="flex flex-wrap justify-between gap-4">
        <span className="w-full text-xs text-gray-400 font-bold uppercase tracking-widest">
          Personal Info
        </span>
        <InputField
          label="First Name"
          name="firstName"
          register={register}
          error={errors.firstName}
        />
        <InputField
          label="Last Name"
          name="lastName"
          register={register}
          error={errors.lastName}
        />
        <InputField
          label="Phone"
          name="phone"
          register={register}
          error={errors.phone}
        />
        <InputField
          label="Address"
          name="address"
          register={register}
          error={errors.address}
        />
        <InputField
          label="Blood Type"
          name="bloodType"
          register={register}
          error={errors.bloodType}
        />
        <InputField
          label="Birthday"
          name="birthday"
          type="date"
          register={register}
          error={errors.birthday}
        />

        {/* Sex Selection */}
        <div className="flex flex-col gap-1 w-full md:w-[31%]">
          <label className="text-xs text-gray-500 font-semibold">Sex</label>
          <select
            {...register("sex")}
            className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none bg-white h-[42px]"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          {errors.sex?.message && (
            <p className="text-[10px] text-red-500 font-medium">
              {errors.sex.message.toString()}
            </p>
          )}
        </div>

        {/* --- Image Upload Field --- */}
        <div className="flex flex-col gap-2 w-full md:w-[31%] justify-center">
          <label
            className="text-xs text-gray-500 font-semibold flex items-center gap-2 cursor-pointer border-2 border-dashed border-gray-200 p-2 rounded-xl hover:bg-gray-50 transition-colors h-[42px]"
            htmlFor="img"
          >
            <Upload size={16} className="text-gray-400" />
            <span className="text-gray-400 truncate">
              {type === "create" ? "Upload a photo" : "Change photo"}
            </span>
          </label>
          <input type="file" id="img" {...register("img")} className="hidden" />
          {errors.img?.message && (
            <p className="text-[10px] text-red-500 font-medium">
              {errors.img.message.toString()}
            </p>
          )}
        </div>
      </div>

      <button className="bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all">
        {type === "create" ? "Create Teacher" : "Update Teacher"}
      </button>
    </form>
  );
};

export default TeacherForm;
