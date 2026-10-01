import Link from "next/link";
import { ArrowLeft, Download, ShieldCheck } from "lucide-react";
import { requireRole } from "@/src/lib/authz";
import StudentImportForm from "@/src/components/StudentImportForm";
import { STUDENT_IMPORT_HEADERS, STUDENT_IMPORT_TEMPLATE } from "@/src/lib/services/student-import";

export default async function StudentImportPage() {
  await requireRole(["admin"]);

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(STUDENT_IMPORT_TEMPLATE)}`;

  return (
    <div className="flex-1 p-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link href="/list/students" className="mb-3 inline-flex items-center gap-2 text-xs font-black text-gray-400 transition hover:text-gray-700">
                <ArrowLeft size={14} /> Back to students
              </Link>
              <h1 className="text-xl font-black tracking-tight text-gray-900">Import Students</h1>
              <p className="mt-1 max-w-2xl text-sm font-semibold text-gray-500">
                Upload a clean CSV to create student records in bulk. Edujay checks every row before saving anything.
              </p>
            </div>
            <a
              href={templateHref}
              download="edujay-student-import-template.csv"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-50 px-4 text-sm font-black text-indigo-700 transition hover:bg-indigo-100"
            >
              <Download size={15} /> Download template
            </a>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <StudentImportForm />

          <aside className="grid gap-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600" />
                <h2 className="text-sm font-black text-gray-900">Rules Edujay enforces</h2>
              </div>
              <ul className="grid gap-2 text-xs font-semibold text-gray-500">
                <li>Admission numbers must be unique in this school.</li>
                <li>Class names must already exist in Edujay.</li>
                <li>Guardian phone or email is required for every row.</li>
                <li>No student login account is created during import.</li>
                <li>If one row has an error, nothing is imported.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black text-gray-900">Required columns</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {STUDENT_IMPORT_HEADERS.map((header) => (
                  <span key={header} className="rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-black text-gray-600">
                    {header}
                  </span>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-3">
                <h2 className="text-sm font-black text-gray-900">Template preview</h2>
              </div>
              <pre className="max-h-64 overflow-auto p-5 text-xs font-semibold leading-relaxed text-gray-500">
                {STUDENT_IMPORT_TEMPLATE}
              </pre>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
