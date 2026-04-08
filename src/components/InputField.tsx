import { FieldError } from "react-hook-form";

type InputFieldProps = {
  label: string;
  type?: string;
  register: any;
  name: string;
  defaultValue?: string;
  error?: FieldError;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
};

const InputField = ({
  label,
  type = "text",
  register,
  name,
  defaultValue,
  error,
  inputProps,
}: InputFieldProps) => {
  return (
    <div className="flex flex-col gap-1 w-full md:w-[31%]">
      <label className="text-xs text-gray-500 font-semibold">{label}</label>
      <input
        type={type}
        {...register(name)}
        className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none transition-all"
        {...inputProps}
        defaultValue={defaultValue}
      />
      {error?.message && (
        <p className="text-[10px] text-red-500 font-medium">
          {error.message.toString()}
        </p>
      )}
    </div>
  );
};

export default InputField;
