// FeatureVisuals.tsx — CSS/SVG visuals for each feature block

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
            <span className="text-xs font-medium" style={{ color: "#10B981", fontFamily: "'DM Sans', sans-serif" }}>Live</span>
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
          {[["4", "Present", "#10B981"], ["1", "Absent", "#EF4444"], ["1", "Late", "#F59E0B"], ["1", "Excused", "#60A5FA"]].map(([v, l, c]) => (
            <div key={l} className="text-center">
              <div className="text-base font-extrabold" style={{ color: c, fontFamily: "'Sora', sans-serif" }}>{v}</div>
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
            <div className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Sora', sans-serif" }}>Term 2 Results — Class 4B</div>
            <div className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>CA 30% · Exam 70% split</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold" style={{ color, fontFamily: "'Sora', sans-serif" }}>78%</div>
            <div className="text-[10px] text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>Class avg</div>
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
          <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: "48px repeat(5, 1fr)" }}>
            <div />
            {days.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>{d}</div>
            ))}
          </div>
          {/* Period rows */}
          {periods.map((row, pi) => (
            <div key={pi} className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: "48px repeat(5, 1fr)" }}>
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
          <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>EduJay · Term 2 Report</div>
          <div className="text-base font-extrabold text-gray-900" style={{ fontFamily: "'Sora', sans-serif" }}>Ama Boateng</div>
          <div className="text-xs text-gray-400 mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>Class 4B · 2025/26 Academic Year</div>
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
            <span className="text-sm font-extrabold" style={{ color, fontFamily: "'Sora', sans-serif" }}>79.4%</span>
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
            ["Science",        "26", "58", "84", "A"],
            ["Social Studies", "18", "48", "66", "C"],
            ["ICT",            "29", "60", "89", "A"],
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
          <div className="text-sm font-extrabold text-gray-900" style={{ fontFamily: "'Sora', sans-serif" }}>GH₵ 42,500</div>
          <div className="text-[9px] text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>Collected · Term 2</div>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden mt-4" style={{ background: "white", border: `1px solid ${color}22`, boxShadow: `0 20px 60px ${color}18, 0 4px 20px rgba(0,0,0,0.06)` }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #f1f1f3" }}>
          <div>
            <div className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Sora', sans-serif" }}>Fee Payments</div>
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
            { label: "Today's Collections", value: "GH₵ 3,400", sub: "+8 payments", color: "#10B981" },
            { label: "Outstanding",          value: "GH₵ 12,750", sub: "15 students",  color: "#EF4444" },
            { label: "Term Total",           value: "GH₵ 42,500", sub: "60% collected",color },
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
            { name: "Kofi Asante",  time: "10:02 AM", amount: "GH₵ 850", method: "Bank Transfer" },
            { name: "Efua Darko",   time: "11:30 AM", amount: "GH₵ 850", method: "Cash" },
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
          <span className="text-xs text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>Auto-reconciled · Updated now</span>
          <div className="flex gap-2">
            {["PDF", "Excel"].map((f) => (
              <div key={f} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: `${color}12`, color, border: `1px solid ${color}22`, fontFamily: "'DM Sans', sans-serif" }}>
                Export {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RolesVisual({ color = "#F59E0B" }: { color?: string }) {
  const roles = [
    { label: "Admin",   desc: "Full school control",        icon: "🛡️", color: "#8B7FF5", perms: ["Manage all users", "View all reports", "Configure system"] },
    { label: "Teacher", desc: "Class & grade management",   icon: "📚", color: "#10B981", perms: ["Mark attendance", "Enter CA scores", "View timetable"] },
    { label: "Student", desc: "Personal academic view",     icon: "🎓", color: "#60A5FA", perms: ["View timetable", "Check results", "See attendance"] },
    { label: "Parent",  desc: "Child progress monitoring",  icon: "👨‍👩‍👧", color: "#FB7185", perms: ["Track attendance", "View results", "Get alerts"] },
  ];

  return (
    <div className="relative w-full grid grid-cols-2 gap-3" style={{ maxWidth: "480px", margin: "0 auto" }}>
      {roles.map((r) => (
        <div key={r.label} className="rounded-2xl p-4 transition-all duration-200 hover:-translate-y-1"
          style={{ background: "white", border: `1px solid ${r.color}20`, boxShadow: `0 4px 20px ${r.color}12` }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">{r.icon}</span>
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