import { RefreshCw } from "lucide-react";

export default function TeacherAccountabilityBusy({ href }: { href: "/teacher" | "/teacher/accountability" }) {
  return (
    <section role="status" className="m-4 border border-amber-200 bg-amber-50 p-5 text-amber-950">
      <h1 className="text-lg font-bold">Your duties are updating</h1>
      <p className="mt-2 text-sm">Another update is in progress. Refresh to load your latest duties before continuing.</p>
      <a href={href} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-edujay-ink px-4 py-2 text-sm font-bold text-white">
        <RefreshCw size={16} aria-hidden="true" /> Refresh duties
      </a>
    </section>
  );
}
