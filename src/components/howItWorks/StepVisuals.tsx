import type { ReactNode } from "react";
import { Building2, ClipboardCheck, FileInput, ListChecks, Mail, UsersRound } from "lucide-react";

function ExampleFrame({ title, subtitle, color, icon, children }: {
  title: string; subtitle: string; color: string; icon: ReactNode; children: ReactNode;
}) {
  return (
    <div className="w-full max-w-[480px] mx-auto rounded-2xl overflow-hidden bg-white"
      style={{ border: `1px solid ${color}22`, boxShadow: `0 20px 60px ${color}18, 0 4px 20px rgba(0,0,0,0.06)` }}>
      <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-100" style={{ background: `${color}06` }}>
        <span className="w-8 h-8 flex-shrink-0 rounded-xl flex items-center justify-center" style={{ color, background: `${color}14` }}>{icon}</span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Sora', sans-serif" }}>{title}</h3>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function AccessVisual({ color = "#8B7FF5" }: { color?: string }) {
  return (
    <ExampleFrame title="School Access" subtitle="An example onboarding journey" color={color} icon={<Building2 size={18} aria-hidden="true" />}>
      <dl className="px-5 py-4 bg-gray-50 text-xs space-y-2 border-b border-gray-100">
        <div className="flex flex-wrap justify-between gap-2"><dt className="text-gray-500">School</dt><dd className="font-semibold text-gray-800">Internal Example School</dd></div>
        <div className="flex flex-wrap justify-between gap-2"><dt className="text-gray-500">Contact</dt><dd className="text-gray-700">Authorised school representative</dd></div>
      </dl>
      <ol className="divide-y divide-gray-100">
        {[
          ["School request", "Share your school's needs and contact details."],
          ["Needs and scope review", "Discuss the package, records, and onboarding scope."],
          ["Administrator invitation", "After approval, invite the first administrator."],
        ].map(([title, text], index) => (
          <li key={title} className="px-5 py-5 flex items-start gap-3">
            <span className="w-7 h-7 flex-shrink-0 rounded-full grid place-items-center text-xs font-bold" style={{ color, background: `${color}12` }}>{index + 1}</span>
            <div className="min-w-0"><p className="text-sm font-semibold text-gray-800">{title}</p><p className="text-xs text-gray-500 leading-relaxed mt-1">{text}</p></div>
          </li>
        ))}
      </ol>
      <p className="px-5 py-4 bg-gray-50 text-xs text-gray-500 border-t border-gray-100">A request begins review; it does not activate a school.</p>
    </ExampleFrame>
  );
}

export function SetupPathsVisual({ color = "#10B981" }: { color?: string }) {
  return (
    <ExampleFrame title="Choose Your Setup Route" subtitle="One school foundation, two ways to begin" color={color} icon={<UsersRound size={18} aria-hidden="true" />}>
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-xs font-bold text-gray-700 mb-3">School foundation</p>
        <div className="flex flex-wrap gap-2">
          {["Academic year & terms", "Classes & subjects", "Staff responsibilities"].map(label => (
            <span key={label} className="text-[10px] px-2 py-1 rounded-md" style={{ color, background: `${color}12` }}>{label}</span>
          ))}
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        <div className="px-5 py-5">
          <div className="flex items-center gap-2 mb-2"><Building2 size={17} color={color} aria-hidden="true" /><h4 className="text-sm font-bold text-gray-800">Start Fresh</h4></div>
          <p className="text-xs text-gray-500 leading-relaxed">Enter the records your school needs through authorised school workflows.</p>
          <p className="text-xs text-gray-600 mt-3">Student records · Guardian links · Staff access</p>
        </div>
        <div className="px-5 py-5">
          <div className="flex items-center gap-2 mb-2"><FileInput size={17} color={color} aria-hidden="true" /><h4 className="text-sm font-bold text-gray-800">Bring Existing Records</h4></div>
          <p className="text-xs text-gray-500 leading-relaxed">Agree files and scope, then validate, review, and reconcile before approval.</p>
          <p className="text-xs text-gray-600 mt-3">Source records · Validation · Reconciliation</p>
        </div>
      </div>
      <p className="px-5 py-4 bg-gray-50 text-xs text-gray-500 border-t border-gray-100">Both routes include setup review and appropriate access.</p>
    </ExampleFrame>
  );
}

export function ReviewVisual({ color = "#F59E0B" }: { color?: string }) {
  return (
    <ExampleFrame title="School Readiness Review" subtitle="Checks before completing onboarding" color={color} icon={<ClipboardCheck size={18} aria-hidden="true" />}>
      <ul className="divide-y divide-gray-100">
        {[
          ["School setup", "Check academic periods, classes, and subjects."],
          ["Student and guardian links", "Confirm the right records are connected."],
          ["Staff permissions", "Check school and role access for invited staff."],
          ["Opening balances", "Where applicable, reconcile against agreed source records."],
        ].map(([title, text]) => (
          <li key={title} className="px-5 py-4 flex items-start gap-3">
            <ListChecks size={18} color={color} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0"><p className="text-sm font-semibold text-gray-800">{title}</p><p className="text-xs text-gray-500 leading-relaxed mt-1">{text}</p></div>
          </li>
        ))}
      </ul>
      <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700"><Mail size={15} aria-hidden="true" />External services are separate</div>
        <p className="text-xs text-gray-500 leading-relaxed mt-2">Online payments and external notifications require their own configuration and verification.</p>
      </div>
    </ExampleFrame>
  );
}
