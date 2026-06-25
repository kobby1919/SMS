"use client";

import { motion } from "framer-motion";

const stats = [
  { value: "50+",  label: "Schools onboarded",    color: "#8B7FF5" },
  { value: "500+", label: "Students managed",      color: "#10B981" },
  { value: "3",    label: "Regions across Ghana",  color: "#F59E0B" },
  { value: "98%",  label: "Satisfaction rate",     color: "#FB7185" },
];

export default function AboutMission() {
  return (
    <section id="mission" className="relative w-full py-24 lg:py-32 overflow-hidden" style={{ background: "white" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 80% 50%, #8B7FF508 0%, transparent 55%)" }} />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          {/* Left — mission text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px w-8 bg-gray-200 rounded-full" />
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400"
                style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.18em" }}>
                Our Mission
              </span>
            </div>

            <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6"
              style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Modernising how
              <br />
              <span style={{ background: "linear-gradient(135deg, #8B7FF5 0%, #A855F7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                schools operate.
              </span>
            </h2>

            <div className="flex flex-col gap-4">
              <p className="text-base text-gray-500 leading-relaxed"
                style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
                Across Ghana, school administrators are still managing attendance in notebooks,
                computing grades in Excel, and chasing fees with paper receipts. It works —
                until it doesn&apos;t. A missed absence alert, a calculation error at term end,
                a misplaced receipt. Small failures with real consequences.
              </p>
              <p className="text-base text-gray-500 leading-relaxed"
                style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
                Our mission is simple — give every Ghanaian school, regardless of size or
                resources, access to the same quality of management tools that international
                schools take for granted. Clean, fast, and reliable software that just works.
              </p>
              <p className="text-base text-gray-500 leading-relaxed"
                style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
                EduJay is not a global product adapted for Ghana. It is built here, from scratch,
                with Ghana&apos;s school structure, curriculum, and workflows at its core.
              </p>
            </div>
          </motion.div>

          {/* Right — stat grid */}
          <motion.div
            className="grid grid-cols-2 gap-4"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                className="rounded-2xl p-8 flex flex-col gap-2"
                style={{ background: `${s.color}08`, border: `1px solid ${s.color}18` }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <div className="text-4xl font-extrabold" style={{ color: s.color, fontFamily: "'Sora', sans-serif" }}>
                  {s.value}
                </div>
                <div className="text-sm text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {s.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
