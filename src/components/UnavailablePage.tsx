import Link from "next/link";
import { ArrowLeft, Home, FileSearch } from "lucide-react";

export default function UnavailablePage({
  title = "This page is unavailable",
  message = "The link may be outdated, or this record is not available to your account.",
  href = "/auth/callback",
  label = "Return to your workspace",
}: { title?: string; message?: string; href?: string; label?: string }) {
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-xl flex-col items-start gap-4 p-5 py-12 font-inter text-sm text-gray-700 sm:p-8 sm:py-16">
      <FileSearch aria-hidden="true" size={32} className="text-blue-700" />
      <h1 className="break-words text-xl font-black text-gray-950">{title}</h1>
      <p className="break-words leading-relaxed">{message}</p>
      <div className="flex max-w-full flex-wrap gap-3">
        <Link href={href} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-md bg-blue-800 px-4 py-2 font-bold text-white">
          <ArrowLeft size={16} className="shrink-0" aria-hidden="true" /><span className="break-words">{label}</span>
        </Link>
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 px-2 py-2 font-bold text-blue-800"><Home size={16} aria-hidden="true" />Edujay home</Link>
      </div>
    </main>
  );
}
