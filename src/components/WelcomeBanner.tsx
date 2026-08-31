"use client";

// src/components/WelcomeBanner.tsx

import { motion } from "framer-motion";
import { BriefcaseBusiness } from "lucide-react";

type Props = {
  role:      "admin" | "teacher" | "student" | "parent" | "bursar";
  name:      string;       // first name or full name
  subtitle?: string;       // e.g. "Class 3A" or "3 children enrolled"
  tag?:      string;       // e.g. "Term 2 · 2025/26"
};

// ── Per-role config ────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  admin: {
    greeting:  "Welcome back",
    roleLabel: "Administrator",
    accent:    "bg-indigo-600",
    ring:      "ring-indigo-100",
    initials:  "bg-indigo-50 text-indigo-700",
    tagBg:     "bg-indigo-50 text-indigo-700",
  },
  teacher: {
    greeting:  "Welcome back",
    roleLabel: "Teacher",
    accent:    "bg-emerald-600",
    ring:      "ring-emerald-100",
    initials:  "bg-emerald-50 text-emerald-700",
    tagBg:     "bg-emerald-50 text-emerald-700",
  },
  student: {
    greeting:  "Welcome",
    roleLabel: "Student",
    accent:    "bg-amber-500",
    ring:      "ring-amber-100",
    initials:  "bg-amber-50 text-amber-700",
    tagBg:     "bg-amber-50 text-amber-700",
  },
  parent: {
    greeting:  "Welcome",
    roleLabel: "Parent",
    accent:    "bg-violet-600",
    ring:      "ring-violet-100",
    initials:  "bg-violet-50 text-violet-700",
    tagBg:     "bg-violet-50 text-violet-700",
  },
  bursar: {
    greeting:  "Welcome back",
    roleLabel: "Bursar",
    accent:    "bg-teal-600",
    ring:      "ring-teal-100",
    initials:  "bg-teal-50 text-teal-700",
    tagBg:     "bg-teal-50 text-teal-700",
  },
};

const WelcomeBanner = ({ role, name, subtitle, tag }: Props) => {
  const cfg  = ROLE_CONFIG[role];
  const date = new Date().toLocaleDateString("en-GH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // Initials from name
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white px-5 py-5 shadow-sm"
    >
      <div className={`absolute inset-y-0 left-0 w-1.5 ${cfg.accent}`} />

      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl ${cfg.initials} ${cfg.ring} ring-2 flex items-center justify-center font-black text-base shrink-0 shadow-sm`}
          >
            {initials}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
              {date}
            </p>

            <h1 className="font-nunito font-extrabold text-xl sm:text-2xl text-gray-900 leading-tight">
              {cfg.greeting}, {name}
            </h1>

            {subtitle && (
              <p className="text-sm text-gray-500 mt-0.5 font-medium">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {tag && (
            <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${cfg.tagBg}`}>
              {tag}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-bold text-white">
            <BriefcaseBusiness size={13} />
            {cfg.roleLabel}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default WelcomeBanner;
