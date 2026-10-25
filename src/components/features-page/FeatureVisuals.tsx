// FeatureVisuals.tsx — CSS/SVG visuals for each feature block
import { BookOpen, FolderOpen, Shield, UsersRound, Wallet } from "lucide-react";

export function RecordsVisual({ color = "#2563a6" }: { color?: string }) {
  const students = [
    { name: "Ama Boateng", className: "Class 4B", guardian: "Guardian A" },
    { name: "Kofi Mensah", className: "Class 4B", guardian: "Guardian B" },
    { name: "Efua Asante", className: "Class 5A", guardian: "Guardian C" },
  ];
  return (
    <div className="w-full max-w-[480px] mx-auto rounded-2xl overflow-hidden bg-white" style={{ border: `1px solid ${color}22`, boxShadow: `0 20px 60px ${color}18` }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <FolderOpen size={24} color={color} aria-hidden="true" />
        <div>
          <div className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Sora', sans-serif" }}>School Records</div>
          <div className="text-xs text-gray-500 mt-1">Students, classes, and linked guardians</div>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {students.map(student => (
          <div key={student.name} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">{student.name}</p>
              <p className="text-xs text-gray-500 mt-1">{student.className}</p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full" style={{ color, background: `${color}10` }}>{student.guardian}</span>
          </div>
        ))}
      </div>
      <div className="px-5 py-4 bg-gray-50 text-xs text-gray-500 border-t border-gray-100">3 students · 2 classes · 3 guardian links</div>
    </div>
  );
}

export function AttendanceVisual({ color = "#10B981" }: { color?: string }) {
  const rows = [
    { name: "Ama Boateng",  status: "Present", color: "#10B981", delay: "0s" },
    { name: "Kofi Mensah",  status: "Absent",  color: "#EF4444", delay: "0.1s" },
    { name: "Efua Asante",  status: "Late",    color: "#F59E0B", delay: "0.2s" },
    { name: "Yaw Darko",    status: "Present", color: "#10B981", delay: "0.3s" },
    { name: "Akua Owusu",   status: "Excused", color: "#60A5FA", delay: "0.4s" },
    { name: "Nana Adjei",   status: "Present", color: "#10B981", delay: "0.5s" },
  ];

  return (
    <div className="relative w-full" style={{ maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ position: "absolute", bottom: "-16px", left: "10%", width: "80%", height: "20px", background: `radial-gradient(ellipse, ${color}33 0%, transparent 70%)`, filter: "blur(10px)" }} />
      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: `1px solid ${color}22`, boxShadow: `0 20px 60px ${color}18, 0 4px 20px rgba(0,0,0,0.06)` }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #f1f1f3" }}>
          <div>
            <div className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Sora', sans-serif" }}>Class 4B — Attendance</div>
            <div className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>Thursday, 14 May 2026</div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#10B981" }} />
            <span className="text-xs font-medium" style={{ color: "#10B981", fontFamily: "'DM Sans', sans-serif" }}>Example</span>
          </div>
        </div>
        {/* Rows */}
        <div className="divide-y divide-gray-50">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${r.color}14`, color: r.color }}>
                  {r.name[0]}
                </div>
                <span className="text-sm text-gray-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>{r.name}</span>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: `${r.color}14`, color: r.color, fontFamily: "'DM Sans', sans-serif" }}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
        {/* Summary */}
        <div className="px-5 py-4 grid grid-cols-4 gap-2" style={{ borderTop: "1px solid #f1f1f3", background: "#fafafa" }}>
          {[["Present", "#10B981"], ["Absent", "#EF4444"], ["Late", "#F59E0B"], ["Excused", "#60A5FA"]].map(([l, c]) => (
            <div key={l} className="text-center">
              <div className="text-base font-extrabold" style={{ color: c, fontFamily: "'Sora', sans-serif" }}>{rows.filter(row => row.status === l).length}</div>
              <div className="text-[10px] text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GradingVisual({ color = "#F59E0B" }: { color?: string }) {
  const subjects = [
    { name: "Mathematics",    ca: 28, exam: 62, grade: "A" },
    { name: "English Lang",   ca: 22, exam: 55, grade: "B" },
    { name: "Science",        ca: 26, exam: 60, grade: "A" },
    { name: "Social Studies", ca: 18, exam: 48, grade: "C" },
    { name: "ICT",            ca: 29, exam: 58, grade: "A" },
  ];
  const gradeColors: Record<string, string> = { A: "#10B981", B: "#60A5FA", C: "#F59E0B", D: "#EF4444" };

  return (
    <div className="relative w-full" style={{ maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ position: "absolute", bottom: "-16px", left: "10%", width: "80%", height: "20px", background: `radial-gradient(ellipse, ${color}33 0%, transparent 70%)`, filter: "blur(10px)" }} />
      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: `1px solid ${color}22`, boxShadow: `0 20px 60px ${color}18, 0 4px 20px rgba(0,0,0,0.06)` }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #f1f1f3" }}>
          <div>
            <div className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Sora', sans-serif" }}>Assessment Summary — Ama Boateng</div>
            <div className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>CA 30% · Exam 70% split</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold" style={{ color, fontFamily: "'Sora', sans-serif" }}>{(subjects.reduce((sum, subject) => sum + subject.ca + subject.exam, 0) / subjects.length).toFixed(1)}%</div>
            <div className="text-[10px] text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>Subject average</div>
          </div>
        </div>
        <div className="px-5 py-3 flex flex-col gap-3">
          {subjects.map((s) => (
            <div key={s.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600" style={{ fontFamily: "'DM Sans', sans-serif" }}>{s.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>{s.ca + s.exam}/100</span>
                  <span className="text-xs font-bold w-5 text-center" style={{ color: gradeColors[s.grade], fontFamily: "'Sora', sans-serif" }}>{s.grade}</span>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "#f3f4f6" }}>
                <div className="h-full rounded-full" style={{ width: `${s.ca + s.exam}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 flex gap-2" style={{ borderTop: "1px solid #f1f1f3", background: "#fafafa" }}>
          {[["A", 3, "#10B981"], ["B", 1, "#60A5FA"], ["C", 1, "#F59E0B"]].map(([g, c, col]) => (
            <div key={g as string} className="flex-1 rounded-xl py-2 text-center" style={{ background: `${col}10` }}>
              <div className="text-sm font-extrabold" style={{ color: col as string, fontFamily: "'Sora', sans-serif" }}>{c}</div>
              <div className="text-[9px] text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>Grade {g}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TimetableVisual({ color = "#8B7FF5" }: { color?: string }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const periods = [
    ["Math", "English", "Science", "Math", "ICT"],
    ["Science", "Math", "English", "ICT", "Social"],
    ["English", "ICT", "Math", "Science", "English"],
    ["ICT", "Social", "Social", "English", "Math"],
  ];
  const subjectColors: Record<string, string> = {
    Math: "#8B7FF5", English: "#10B981", Science: "#F59E0B", ICT: "#60A5FA", Social: "#FB7185",
  };

  return (
    <div className="relative w-full" style={{ maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ position: "absolute", bottom: "-16px", left: "10%", width: "80%", height: "20px", background: `radial-gradient(ellipse, ${color}33 0%, transparent 70%)`, filter: "blur(10px)" }} />
      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: `1px solid ${color}22`, boxShadow: `0 20px 60px ${color}18, 0 4px 20px rgba(0,0,0,0.06)` }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #f1f1f3" }}>
          <div className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Sora', sans-serif" }}>Class 4B Timetable</div>
          <div className="flex gap-1.5">
            {["Week", "Day"].map((v, i) => (
              <div key={v} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: i === 0 ? color : "#f3f4f6", color: i === 0 ? "white" : "#9ca3af", fontFamily: "'DM Sans', sans-serif" }}>{v}</div>
            ))}
          </div>
        </div>
        <div className="p-4">
          {/* Day headers */}
          <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: "28px repeat(5, minmax(0, 1fr))" }}>
            <div />
            {days.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>{d}</div>
            ))}
          </div>
          {/* Period rows */}
          {periods.map((row, pi) => (
            <div key={pi} className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: "28px repeat(5, minmax(0, 1fr))" }}>
              <div className="flex items-center justify-center text-[9px] text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>P{pi + 1}</div>
              {row.map((subj, di) => (
                <div key={di} className="rounded-lg py-2 text-center text-[9px] font-semibold"
                  style={{ background: `${subjectColors[subj]}18`, color: subjectColors[subj], fontFamily: "'DM Sans', sans-serif" }}>
                  {subj}
                </div>
              ))}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="px-5 py-3 flex flex-wrap gap-2" style={{ borderTop: "1px solid #f1f1f3", background: "#fafafa" }}>
          {Object.entries(subjectColors).map(([s, c]) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: c }} />
              <span className="text-[9px] text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ResultsVisual({ color = "#60A5FA" }: { color?: string }) {
  return (
    <div className="relative w-full" style={{ maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ position: "absolute", bottom: "-16px", left: "10%", width: "80%", height: "20px", background: `radial-gradient(ellipse, ${color}33 0%, transparent 70%)`, filter: "blur(10px)" }} />
      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: `1px solid ${color}22`, boxShadow: `0 20px 60px ${color}18, 0 4px 20px rgba(0,0,0,0.06)` }}>
        {/* Report header */}
        <div className="px-6 py-5 text-center" style={{ borderBottom: "1px solid #f1f1f3", background: `${color}08` }}>
          <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>Edujay · Term 2 Report</div>
          <div className="text-base font-extrabold text-gray-900" style={{ fontFamily: "'Sora', sans-serif" }}>Ama Boateng</div>
          <div className="text-xs text-gray-400 mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>Class 4B · 2025/26 Academic Year</div>
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
            <span className="text-sm font-extrabold" style={{ color, fontFamily: "'Sora', sans-serif" }}>81.2%</span>
            <span className="text-xs text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>Overall Average</span>
          </div>
        </div>
        {/* Subject table */}
        <div className="px-5 py-3">
          <div className="grid text-[10px] font-bold text-gray-400 mb-2 pb-2" style={{ gridTemplateColumns: "1fr 40px 40px 40px 24px", borderBottom: "1px solid #f3f4f6", fontFamily: "'DM Sans', sans-serif" }}>
            <span>Subject</span><span className="text-center">CA</span><span className="text-center">Exam</span><span className="text-center">Total</span><span className="text-center">Grd</span>
          </div>
          {[
            ["Mathematics",    "28", "62", "90", "A"],
            ["English",        "22", "55", "77", "B"],
            ["Science",        "26", "60", "86", "A"],
            ["Social Studies", "18", "48", "66", "C"],
            ["ICT",            "29", "58", "87", "A"],
          ].map(([s, ca, ex, tot, g]) => {
            const gc: Record<string, string> = { A: "#10B981", B: "#60A5FA", C: "#F59E0B" };
            return (
              <div key={s} className="grid py-2 text-xs" style={{ gridTemplateColumns: "1fr 40px 40px 40px 24px", borderBottom: "1px solid #f9fafb" }}>
                <span className="text-gray-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>{s}</span>
                <span className="text-center text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>{ca}</span>
                <span className="text-center text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>{ex}</span>
                <span className="text-center font-semibold text-gray-800" style={{ fontFamily: "'Sora', sans-serif" }}>{tot}</span>
                <span className="text-center font-bold" style={{ color: gc[g] || "#6b7280", fontFamily: "'Sora', sans-serif" }}>{g}</span>
              </div>
            );
          })}
        </div>
        {/* Print button */}
        <div className="px-5 py-3 flex justify-end" style={{ borderTop: "1px solid #f1f1f3", background: "#fafafa" }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, fontFamily: "'DM Sans', sans-serif" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M6 9V2H18V9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 18H4C3 18 2 17 2 16V11C2 10 3 9 4 9H20C21 9 22 10 22 11V16C22 17 21 18 20 18H18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 14H18V22H6V14Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Print / Export PDF
          </div>
        </div>
      </div>
    </div>
  );
}

export function FinanceVisual({ color = "#FB7185" }: { color?: string }) {
  const transactions = [
    { name: "Ama Boateng",  amount: "GH₵ 850", status: "Paid",    sc: "#10B981" },
    { name: "Kofi Mensah",  amount: "GH₵ 850", status: "Pending", sc: "#F59E0B" },
    { name: "Efua Asante",  amount: "GH₵ 850", status: "Paid",    sc: "#10B981" },
    { name: "Yaw Darko",    amount: "GH₵ 850", status: "Overdue", sc: "#EF4444" },
    { name: "Akua Owusu",   amount: "GH₵ 850", status: "Paid",    sc: "#10B981" },
  ];

  return (
    <div className="relative w-full" style={{ maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ position: "absolute", bottom: "-16px", left: "10%", width: "80%", height: "20px", background: `radial-gradient(ellipse, ${color}33 0%, transparent 70%)`, filter: "blur(10px)" }} />
      {/* Summary pill floating above */}
      <div className="absolute -top-6 right-4 flex items-center gap-2 px-4 py-2 rounded-xl z-10"
        style={{ background: "white", border: `1px solid ${color}22`, boxShadow: `0 8px 24px ${color}18` }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}14` }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="5" width="20" height="14" rx="2" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <line x1="2" y1="10" x2="22" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-extrabold text-gray-900" style={{ fontFamily: "'Sora', sans-serif" }}>GH₵ 2,550</div>
          <div className="text-[9px] text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>Collected · 5 sample bills</div>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden mt-4" style={{ background: "white", border: `1px solid ${color}22`, boxShadow: `0 20px 60px ${color}18, 0 4px 20px rgba(0,0,0,0.06)` }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #f1f1f3" }}>
          <div>
            <div className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Sora', sans-serif" }}>Fee Bills</div>
            <div className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>Term 2 · 2025/26</div>
          </div>
          <div className="flex gap-1.5">
            {[["Paid", "#10B981"], ["Pending", "#F59E0B"], ["Overdue", "#EF4444"]].map(([l, c]) => (
              <div key={l} className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${c}14`, color: c, fontFamily: "'DM Sans', sans-serif" }}>{l}</div>
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {transactions.map((t) => (
            <div key={t.name} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${t.sc}14`, color: t.sc }}>{t.name[0]}</div>
                <span className="text-sm text-gray-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>{t.name}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-800" style={{ fontFamily: "'Sora', sans-serif" }}>{t.amount}</div>
                <div className="text-[10px]" style={{ color: t.sc, fontFamily: "'DM Sans', sans-serif" }}>{t.status}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3" style={{ borderTop: "1px solid #f1f1f3", background: "#fafafa" }}>
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
            <div className="rounded-full" style={{ flex: 3, background: "#10B981" }} />
            <div className="rounded-full" style={{ flex: 1, background: "#F59E0B" }} />
            <div className="rounded-full" style={{ flex: 1, background: "#EF4444" }} />
          </div>
          <div className="flex justify-between mt-1.5">
            {[["60% Paid", "#10B981"], ["20% Pending", "#F59E0B"], ["20% Overdue", "#EF4444"]].map(([l, c]) => (
              <span key={l} className="text-[9px]" style={{ color: c, fontFamily: "'DM Sans', sans-serif" }}>{l}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BursarVisual({ color = "#A855F7" }: { color?: string }) {
  return (
    <div className="relative w-full" style={{ maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ position: "absolute", bottom: "-16px", left: "10%", width: "80%", height: "20px", background: `radial-gradient(ellipse, ${color}33 0%, transparent 70%)`, filter: "blur(10px)" }} />
      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: `1px solid ${color}22`, boxShadow: `0 20px 60px ${color}18, 0 4px 20px rgba(0,0,0,0.06)` }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid #f1f1f3", background: `${color}06` }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="5" width="20" height="14" rx="2" stroke={color} strokeWidth="1.8" />
              <line x1="2" y1="10" x2="22" y2="10" stroke={color} strokeWidth="1.8" />
              <path d="M6 15H8M12 15H16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Sora', sans-serif" }}>Bursar Dashboard</div>
            <div className="text-xs text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>Thursday, 14 May 2026</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: `${color}14`, border: `1px solid ${color}28` }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            <span className="text-[10px] font-semibold" style={{ color, fontFamily: "'DM Sans', sans-serif" }}>Term 2</span>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-0 divide-x divide-gray-100 px-0" style={{ borderBottom: "1px solid #f1f1f3" }}>
          {[
            { label: "Today's Collections", value: "GH₵ 2,550", sub: "3 payments", color: "#10B981" },
            { label: "Outstanding",          value: "GH₵ 1,700", sub: "2 students",  color: "#EF4444" },
            { label: "Term Total",           value: "GH₵ 2,550", sub: "60% collected",color },
          ].map((k) => (
            <div key={k.label} className="px-4 py-4">
              <div className="text-[9px] text-gray-400 mb-1 uppercase tracking-wide" style={{ fontFamily: "'DM Sans', sans-serif" }}>{k.label}</div>
              <div className="text-base font-extrabold" style={{ color: k.color, fontFamily: "'Sora', sans-serif" }}>{k.value}</div>
              <div className="text-[9px] text-gray-400 mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Recent payments */}
        <div className="px-5 py-3">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Recent Payments</div>
          {[
            { name: "Ama Boateng",  time: "9:14 AM",  amount: "GH₵ 850", method: "Mobile Money" },
            { name: "Efua Asante",  time: "10:02 AM", amount: "GH₵ 850", method: "Bank Transfer" },
            { name: "Akua Owusu",   time: "11:30 AM", amount: "GH₵ 850", method: "Cash" },
          ].map((p) => (
            <div key={p.name} className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid #f9fafb" }}>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: `${color}14`, color }}>{p.name[0]}</div>
                <div>
                  <div className="text-xs font-medium text-gray-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>{p.name}</div>
                  <div className="text-[9px] text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>{p.method} · {p.time}</div>
                </div>
              </div>
              <span className="text-xs font-semibold" style={{ color: "#10B981", fontFamily: "'Sora', sans-serif" }}>{p.amount}</span>
            </div>
          ))}
        </div>

        {/* Export bar */}
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: "1px solid #f1f1f3", background: "#fafafa" }}>
          <span className="text-xs text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>5 sample bills · GH₵ 4,250 billed</span>
          <div className="flex gap-2">
            {["Collection summary"].map((f) => (
              <div key={f} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: `${color}12`, color, border: `1px solid ${color}22`, fontFamily: "'DM Sans', sans-serif" }}>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RolesVisual() {
  const roles = [
    { label: "Admin", desc: "School management", icon: Shield, color: "#8B7FF5", perms: ["School setup", "Manage school records", "Review school reports"] },
    { label: "Teacher", desc: "Assigned teaching", icon: BookOpen, color: "#10B981", perms: ["Record attendance", "Enter assigned scores", "View timetable"] },
    { label: "Bursar", desc: "Finance workspace", icon: Wallet, color: "#60A5FA", perms: ["Record payments", "Review balances", "Access finance reports"] },
    { label: "Parent", desc: "Linked children only", icon: UsersRound, color: "#FB7185", perms: ["Review attendance", "View published reports", "Review fee balances"] },
  ];

  return (
    <div className="relative w-full grid grid-cols-2 gap-3" style={{ maxWidth: "480px", margin: "0 auto" }}>
      {roles.map(({ icon: Icon, ...r }) => (
        <div key={r.label} className="rounded-2xl p-4 transition-all duration-200 hover:-translate-y-1"
          style={{ background: "white", border: `1px solid ${r.color}20`, boxShadow: `0 4px 20px ${r.color}12` }}>
          <div className="flex items-center gap-2 mb-3">
            <Icon size={22} color={r.color} className="flex-shrink-0" aria-hidden="true" />
            <div>
              <div className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Sora', sans-serif" }}>{r.label}</div>
              <div className="text-[9px] text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>{r.desc}</div>
            </div>
          </div>
          <ul className="flex flex-col gap-1.5">
            {r.perms.map((p) => (
              <li key={p} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${r.color}18` }}>
                  <svg width="6" height="6" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13L9 17L19 7" stroke={r.color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-[9px] text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
