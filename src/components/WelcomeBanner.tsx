"use client";

// src/components/WelcomeBanner.tsx

import { motion } from "framer-motion";

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
    emoji:     "👋",
    roleLabel: "Administrator",
    gradient:  "from-[#f0f4ff] via-[#e8eeff] to-[#f5f0ff]",
    accent:    "bg-indigo-600 text-white",
    dot:       "bg-indigo-400",
    ring:      "ring-indigo-200",
    initials:  "bg-indigo-100 text-indigo-700",
    tagBg:     "bg-white/80 text-indigo-600 border border-indigo-100",
    sub:       "text-indigo-400",
  },
  teacher: {
    greeting:  "Good morning",
    emoji:     "📚",
    roleLabel: "Teacher",
    gradient:  "from-[#f0fdf8] via-[#ecfdf5] to-[#f0f9ff]",
    accent:    "bg-emerald-600 text-white",
    dot:       "bg-emerald-400",
    ring:      "ring-emerald-200",
    initials:  "bg-emerald-100 text-emerald-700",
    tagBg:     "bg-white/80 text-emerald-600 border border-emerald-100",
    sub:       "text-emerald-400",
  },
  student: {
    greeting:  "Hey",
    emoji:     "🎒",
    roleLabel: "Student",
    gradient:  "from-[#fffbeb] via-[#fef3c7] to-[#fefce8]",
    accent:    "bg-amber-500 text-white",
    dot:       "bg-amber-400",
    ring:      "ring-amber-200",
    initials:  "bg-amber-100 text-amber-700",
    tagBg:     "bg-white/80 text-amber-600 border border-amber-100",
    sub:       "text-amber-400",
  },
  parent: {
    greeting:  "Welcome",
    emoji:     "🏠",
    roleLabel: "Parent",
    gradient:  "from-[#fdf4ff] via-[#fae8ff] to-[#fdf2f8]",
    accent:    "bg-violet-600 text-white",
    dot:       "bg-violet-400",
    ring:      "ring-violet-200",
    initials:  "bg-violet-100 text-violet-700",
    tagBg:     "bg-white/80 text-violet-600 border border-violet-100",
    sub:       "text-violet-400",
  },
  bursar: {
    greeting:  "Welcome back",
    emoji:     "💰",
    roleLabel: "Bursar",
    gradient:  "from-[#f0fdf4] via-[#dcfce7] to-[#f0fdfa]",
    accent:    "bg-teal-600 text-white",
    dot:       "bg-teal-400",
    ring:      "ring-teal-200",
    initials:  "bg-teal-100 text-teal-700",
    tagBg:     "bg-white/80 text-teal-600 border border-teal-100",
    sub:       "text-teal-400",
  },
};

// ── Animated dot decoration ────────────────────────────────────────────────────
const Dot = ({ color, delay, x, y, size }: { color: string; delay: number; x: string; y: string; size: number }) => (
  <motion.div
    className={`absolute rounded-full ${color} opacity-30`}
    style={{ left: x, top: y, width: size, height: size }}
    animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.45, 0.2] }}
    transition={{ duration: 3 + delay, repeat: Infinity, delay, ease: "easeInOut" }}
  />
);

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
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${cfg.gradient} border border-white/60 shadow-sm px-6 py-5`}
    >
      {/* Decorative blobs */}
      <Dot color={cfg.dot} delay={0}   x="78%"  y="10%"  size={60} />
      <Dot color={cfg.dot} delay={1.2} x="88%"  y="55%"  size={40} />
      <Dot color={cfg.dot} delay={0.6} x="68%"  y="70%"  size={28} />

      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        {/* Left — avatar + text */}
        <div className="flex items-center gap-4">
          {/* Avatar circle */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 18 }}
            className={`w-12 h-12 rounded-2xl ${cfg.initials} ${cfg.ring} ring-2 flex items-center justify-center font-black text-base shrink-0 shadow-sm`}
          >
            {initials}
          </motion.div>

          <div>
            {/* Date line */}
            <p className={`text-[11px] font-bold uppercase tracking-widest ${cfg.sub} mb-0.5`}>
              {date}
            </p>

            {/* Main greeting */}
            <motion.h1
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              className="font-nunito font-extrabold text-xl sm:text-2xl text-gray-800 leading-tight"
            >
              {cfg.greeting}, {name} {cfg.emoji}
            </motion.h1>

            {/* Subtitle */}
            {subtitle && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-sm text-gray-500 mt-0.5 font-medium"
              >
                {subtitle}
              </motion.p>
            )}
          </div>
        </div>

        {/* Right — tags */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25, duration: 0.35 }}
          className="flex items-center gap-2 flex-wrap"
        >
          {tag && (
            <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${cfg.tagBg} shadow-sm`}>
              {tag}
            </span>
          )}
          <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${cfg.accent} shadow-sm`}>
            {cfg.roleLabel}
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default WelcomeBanner;
