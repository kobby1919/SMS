"use client";

import { X, AlertTriangle, Trash2, Edit, Plus } from "lucide-react";
import { useState } from "react";
import dynamic from "next/dynamic";

// 1. Dynamically import forms to reduce initial bundle size
const TeacherForm = dynamic(() => import("./TeacherForm"), {
  loading: () => <div className="py-10 text-center text-gray-400 animate-pulse font-medium">Loading Form...</div>,
});

// Add other forms as you create them
// const StudentForm = dynamic(() => import("./StudentForm"));

// 2. Updated map to use the dynamic components
const forms: Record<string, (type: "create" | "update", data?: any) => React.ReactNode> = {
  teacher: (type, data) => <TeacherForm type={type} data={data} />,
  // student: (type, data) => <StudentForm type={type} data={data} />,
};

const FormModal = ({
  table,
  type,
  data,
  id,
}: {
  table:
    | "teacher" | "student" | "parent" | "subject" | "class"
    | "lesson" | "exam" | "assignment" | "result"
    | "attendance" | "event" | "announcement";
  type: "create" | "update" | "delete";
  data?: any;
  id?: number;
}) => {
  const [open, setOpen] = useState(false);

  const buttonStyles = {
    create: "bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm shadow-indigo-100 transition-all active:scale-95",
    update: "w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors active:scale-90",
    delete: "w-8 h-8 flex items-center justify-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors active:scale-90",
  };

  const Form = () => {
    if (type === "delete" && id) {
      return (
        <form action="" className="flex flex-col items-center text-center py-4">
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="text-rose-600" size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Confirm Deletion</h2>
          <p className="text-gray-500 mt-2 max-w-[300px]">
            Are you sure you want to delete this <span className="font-semibold text-gray-700">{table}</span>?
          </p>
          <div className="flex items-center gap-3 mt-8 w-full">
            <button 
              type="button" 
              onClick={() => setOpen(false)} 
              className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button className="flex-1 py-2.5 bg-rose-600 text-white font-semibold rounded-xl shadow-lg shadow-rose-100 hover:bg-rose-700 transition-colors">
              Delete
            </button>
          </div>
        </form>
      );
    }

    if (type === "create" || type === "update") {
      const FormComponent = forms[table];
      return FormComponent ? FormComponent(type, data) : (
        <div className="py-10 text-center text-gray-400 italic font-medium">
          {type.charAt(0).toUpperCase() + type.slice(1)} form for {table} coming soon...
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <button 
        className={buttonStyles[type]} 
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        {type === "create" && (
          <>
            <Plus size={18} strokeWidth={3} />
            <span className="hidden sm:inline font-bold text-sm tracking-tight uppercase">Add {table}</span>
          </>
        )}
        {type === "update" && <Edit size={16} />}
        {type === "delete" && <Trash2 size={16} />}
      </button>

      {open && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className={`bg-white rounded-3xl relative w-full ${type === "delete" ? "max-w-md" : "max-w-[90%] md:max-w-[70%] lg:max-w-[60%] xl:max-w-[50%]"} shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300`}>
            
            <button 
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg z-10 transition-colors" 
              onClick={() => setOpen(false)}
            >
              <X size={20} />
            </button>

            <div className="p-8 max-h-[90vh] overflow-y-auto">
              <Form />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FormModal;