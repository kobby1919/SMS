// StepVisuals.tsx — UI visuals for each How It Works step

export function SetupVisual({ color = "#8B7FF5" }: { color?: string }) {
  const fields = [
    { label: "School Name",     value: "Bright Future Academy",  done: true },
    { label: "Academic Year",   value: "2025/2026",              done: true },
    { label: "Current Term",    value: "Term 2",                 done: true },
    { label: "School Type",     value: "Basic School (JHS)",     done: true },
    { label: "Region",          value: "Greater Accra",          done: true },
  ];

  const classes = ["Class 1A", "Class 2B", "Class 3A", "Class 4B", "JHS 1", "JHS 2"];
  const subjects = ["Mathematics", "English", "Science", "Social Studies", "ICT", "French"];

  return (
    <div className="relative w-full" style={{ maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ position: "absolute", bottom: "-16px", left: "10%", width: "80%", height: "20px", background: `radial-gradient(ellipse, ${color}33 0%, transparent 70%)`, filter: "blur(10px)" }} />
      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: `1px solid ${color}22`, boxShadow: `0 20px 60px ${color}18, 0 4px 20px rgba(0,0,0,0.06)` }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid #f1f1f3", background: `${color}06` }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M3 9L12 2L21 9V20C21 20.6 20.6 21 20 21H15V15H9V21H4C3.4 21 3 20.6 3 20V9Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Sora', sans-serif" }}>School Setup</div>
            <div className="text-xs text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>Configure your school profile</div>
          </div>
          <div className="ml-auto px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ background: "#D1FAE5", color: "#059669", fontFamily: "'DM Sans', sans-serif" }}>
            5/5 Complete
          </div>
        </div>

        {/* Fields */}
        <div className="px-5 py-4 flex flex-col gap-2.5">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #f1f1f3" }}>
              <div>
                <div className="text-[10px] text-gray-400 mb-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>{f.label}</div>
                <div className="text-xs font-semibold text-gray-800" style={{ fontFamily: "'Sora', sans-serif" }}>{f.value}</div>
              </div>
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#D1FAE5" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13L9 17L19 7" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Classes + Subjects */}
        <div className="px-5 pb-4 grid grid-cols-2 gap-3" style={{ borderTop: "1px solid #f1f1f3", paddingTop: "12px" }}>
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Classes Added</div>
            <div className="flex flex-wrap gap-1">
              {classes.map((c) => (
                <span key={c} className="px-2 py-0.5 rounded-md text-[9px] font-medium" style={{ background: `${color}12`, color, fontFamily: "'DM Sans', sans-serif" }}>{c}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Subjects Added</div>
            <div className="flex flex-wrap gap-1">
              {subjects.map((s) => (
                <span key={s} className="px-2 py-0.5 rounded-md text-[9px] font-medium" style={{ background: "#f3f4f6", color: "#6b7280", fontFamily: "'DM Sans', sans-serif" }}>{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PeopleVisual({ color = "#10B981" }: { color?: string }) {
  const people = [
    { name: "Mr. Kweku Asante",  role: "Teacher",  class: "Class 4B",  status: "Invited", sc: "#10B981" },
    { name: "Ama Boateng",       role: "Student",  class: "Class 4B",  status: "Active",  sc: "#60A5FA" },
    { name: "Mrs. Grace Owusu",  role: "Parent",   class: "—",         status: "Active",  sc: "#F59E0B" },
    { name: "Kofi Mensah",       role: "Student",  class: "JHS 1",     status: "Active",  sc: "#60A5FA" },
    { name: "Mr. Yaw Darko",     role: "Teacher",  class: "JHS 1–3",   status: "Active",  sc: "#10B981" },
  ];

  const roleColors: Record<string, string> = { Teacher: "#10B981", Student: "#60A5FA", Parent: "#F59E0B", Admin: "#8B7FF5" };

  return (
    <div className="relative w-full" style={{ maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ position: "absolute", bottom: "-16px", left: "10%", width: "80%", height: "20px", background: `radial-gradient(ellipse, ${color}33 0%, transparent 70%)`, filter: "blur(10px)" }} />

      {/* Floating role summary */}
      <div className="absolute -top-5 right-2 flex gap-2 z-10">
        {[["4", "Teachers", "#10B981"], ["18", "Students", "#60A5FA"], ["14", "Parents", "#F59E0B"]].map(([v, l, c]) => (
          <div key={l} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl" style={{ background: "white", border: `1px solid ${c}22`, boxShadow: `0 4px 12px ${c}14` }}>
            <span className="text-xs font-extrabold" style={{ color: c as string, fontFamily: "'Sora', sans-serif" }}>{v}</span>
            <span className="text-[9px] text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>{l}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden mt-4" style={{ background: "white", border: `1px solid ${color}22`, boxShadow: `0 20px 60px ${color}18, 0 4px 20px rgba(0,0,0,0.06)` }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #f1f1f3" }}>
          <div>
            <div className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Sora', sans-serif" }}>People Management</div>
            <div className="text-xs text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>Bright Future Academy</div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, fontFamily: "'DM Sans', sans-serif" }}>
            + Invite
          </div>
        </div>

        {/* Role tabs */}
        <div className="flex px-5 pt-3 gap-2">
          {["All", "Teachers", "Students", "Parents"].map((t, i) => (
            <div key={t} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: i === 0 ? color : "#f3f4f6", color: i === 0 ? "white" : "#9ca3af", fontFamily: "'DM Sans', sans-serif" }}>{t}</div>
          ))}
        </div>

        {/* People list */}
        <div className="divide-y divide-gray-50 mt-2">
          {people.map((p) => (
            <div key={p.name} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${roleColors[p.role]}14`, color: roleColors[p.role] }}>
                  {p.name.split(" ").pop()![0]}
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-800" style={{ fontFamily: "'DM Sans', sans-serif" }}>{p.name}</div>
                  <div className="text-[10px] text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>{p.class}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${roleColors[p.role]}14`, color: roleColors[p.role], fontFamily: "'DM Sans', sans-serif" }}>{p.role}</span>
                <span className="text-[9px] font-medium" style={{ color: p.status === "Active" ? "#10B981" : "#F59E0B", fontFamily: "'DM Sans', sans-serif" }}>{p.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Clerk auth note */}
        <div className="px-5 py-3 flex items-center gap-2" style={{ borderTop: "1px solid #f1f1f3", background: "#fafafa" }}>
          <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: "#6C47FF" }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L4 7V12C4 16.4 7.4 20.5 12 21.5C16.6 20.5 20 16.4 20 12V7L12 3Z" />
            </svg>
          </div>
          <span className="text-[10px] text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Secured by Clerk — every user gets their own login
          </span>
        </div>
      </div>
    </div>
  );
}

export function RunVisual({ color = "#F59E0B" }: { color?: string }) {
  return (
    <div className="relative w-full" style={{ maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ position: "absolute", bottom: "-16px", left: "10%", width: "80%", height: "20px", background: `radial-gradient(ellipse, ${color}33 0%, transparent 70%)`, filter: "blur(10px)" }} />
      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: `1px solid ${color}22`, boxShadow: `0 20px 60px ${color}18, 0 4px 20px rgba(0,0,0,0.06)` }}>

        {/* Dashboard topbar */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #f1f1f3", background: `${color}06` }}>
          <div>
            <div className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Sora', sans-serif" }}>Admin Dashboard</div>
            <div className="text-xs text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>Bright Future Academy · Term 2</div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#10B981" }} />
            <span className="text-[10px] font-medium" style={{ color: "#10B981", fontFamily: "'DM Sans', sans-serif" }}>All systems live</span>
          </div>
        </div>

        {/* Module grid */}
        <div className="p-4 grid grid-cols-2 gap-3">
          {[
            { label: "Attendance",  stat: "94% present today",  icon: "✓", color: "#10B981", active: true },
            { label: "Grading",     stat: "42 scores entered",  icon: "A", color: "#F59E0B", active: true },
            { label: "Timetable",   stat: "No conflicts",       icon: "◉", color: "#8B7FF5", active: true },
            { label: "Results",     stat: "Term 2 ready",       icon: "↗", color: "#60A5FA", active: true },
            { label: "Finance",     stat: "GH₵ 3,400 today",   icon: "₵", color: "#FB7185", active: true },
            { label: "Bursar",      stat: "60% collected",      icon: "✦", color: "#A855F7", active: true },
          ].map((m) => (
            <div key={m.label} className="rounded-xl p-3 flex items-start gap-2.5"
              style={{ background: `${m.color}08`, border: `1px solid ${m.color}18` }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: `${m.color}20`, color: m.color }}>
                {m.icon}
              </div>
              <div>
                <div className="text-xs font-bold text-gray-800 mb-0.5" style={{ fontFamily: "'Sora', sans-serif" }}>{m.label}</div>
                <div className="text-[9px] text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>{m.stat}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="px-4 pb-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Quick Actions</div>
          <div className="flex gap-2">
            {["Mark Attendance", "Enter CA Scores", "Print Results"].map((a, i) => (
              <div key={a} className="flex-1 py-2 rounded-xl text-center text-[9px] font-semibold transition-all"
                style={{ background: i === 0 ? `${color}15` : "#f3f4f6", color: i === 0 ? color : "#9ca3af", border: i === 0 ? `1px solid ${color}25` : "1px solid #f1f1f3", fontFamily: "'DM Sans', sans-serif" }}>
                {a}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}