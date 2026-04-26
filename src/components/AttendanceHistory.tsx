"use client";

// src/components/AttendanceHistory.tsx
// Used on student and parent pages to show attendance history

import { useState } from "react";
import { CheckCircle2, XCircle, Clock, FileCheck, TrendingUp } from "lucide-react";

type AttendanceEntry = {
  date:        string;
  status:      "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  subjectName: string;
  note?:       string | null;
};

type Props = {
  history:     AttendanceEntry[];
  studentName: string;
};

const STATUS_CONFIG = {
  PRESENT: { icon: <CheckCircle2 size={12} />, color: "bg-emerald-500", text: "text-emerald-700", light: "bg-emerald-50" },
  ABSENT:  { icon: <XCircle      size={12} />, color: "bg-rose-500",    text: "text-rose-700",    light: "bg-rose-50"    },
  LATE:    { icon: <Clock        size={12} />, color: "bg-amber-500",   text: "text-amber-700",   light: "bg-amber-50"   },
  EXCUSED: { icon: <FileCheck    size={12} />, color: "bg-indigo-500",  text: "text-indigo-700",  light: "bg-indigo-50"  },
};

const AttendanceHistory = ({ history, studentName }: Props) => {
  const [filter, setFilter] = useState<string>("all");

  // Stats
  const total   = history.length;
  const present = history.filter((h) => h.status === "PRESENT").length;
  const absent  = history.filter((h) => h.status === "ABSENT").length;
  const late    = history.filter((h) => h.status === "LATE").length;
  const excused = history.filter((h) => h.status === "EXCUSED").length;
  const rate    = total > 0 ? Math.round((present / total) * 100) : 0;

  const filtered = filter === "all"
    ? history
    : history.filter((h) => h.status === filter);

  // Group by date
  const grouped = filtered.reduce((acc, entry) => {
    const d = new Date(entry.date).toLocaleDateString("en-GH", {
      weekday: "short", day: "numeric", month: "short",
    });
    if (!acc[d]) acc[d] = [];
    acc[d].push(entry);
    return acc;
  }, {} as Record<string, AttendanceEntry[]>);

  return (
    <div className="flex flex-col gap-4">

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total",    value: total,   color: "bg-gray-50 text-gray-600"           },
          { label: "Present",  value: present, color: "bg-emerald-50 text-emerald-700"      },
          { label: "Absent",   value: absent,  color: "bg-rose-50 text-rose-700"            },
          { label: "Late",     value: late,    color: "bg-amber-50 text-amber-700"          },
          { label: "Rate",     value: `${rate}%`, color: "bg-violet-50 text-violet-700"    },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl p-3 ${s.color} flex flex-col`}>
            <p className="text-2xl font-black leading-none">{s.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-wide opacity-60 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Attendance rate bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider text-gray-400">
            Attendance Rate
          </span>
          <span className={`text-sm font-black ${rate >= 80 ? "text-emerald-600" : rate >= 60 ? "text-amber-600" : "text-rose-600"}`}>
            {rate}%
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${rate >= 80 ? "bg-emerald-500" : rate >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
            style={{ width: `${rate}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-400 font-medium mt-1.5">
          {rate >= 80 ? "✅ Good attendance" : rate >= 60 ? "⚠️ Attendance needs improvement" : "❌ Poor attendance — action required"}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl w-fit">
        {["all", "PRESENT", "ABSENT", "LATE", "EXCUSED"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all capitalize
              ${filter === f ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
          >
            {f.toLowerCase()}
          </button>
        ))}
      </div>

      {/* History grouped by date */}
      <div className="flex flex-col gap-3">
        {Object.entries(grouped).length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-gray-400 font-semibold text-sm">No records found</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, entries]) => (
            <div key={date} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-50 bg-gray-50/40">
                <p className="text-xs font-black text-gray-500 uppercase tracking-wider">{date}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {entries.map((entry, i) => {
                  const cfg = STATUS_CONFIG[entry.status];
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.color}`} />
                      <span className="text-sm font-semibold text-gray-700 flex-1">{entry.subjectName}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${cfg.light} ${cfg.text}`}>
                        {entry.status}
                      </span>
                      {entry.note && (
                        <span className="text-[10px] text-gray-400 italic hidden sm:block">
                          "{entry.note}"
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AttendanceHistory;