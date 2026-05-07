"use client";

import { motion } from "framer-motion";

const testimonials = [
  {
    quote:
      "EduJay completely changed how we manage our school. Attendance used to take 30 minutes every morning — now it's done in seconds.",
    name: "Mrs. Abena Asante",
    role: "Headmistress",
    school: "Blessed Kids Academy, Accra",
    initials: "AA",
    color: "#8B7FF5",
  },
  {
    quote:
      "The grading system is exactly what we needed. CA scores feed straight into the results — no more manual calculations or errors at term end.",
    name: "Mr. Kweku Mensah",
    role: "Class Teacher",
    school: "Bright Future JHS, Kumasi",
    initials: "KM",
    color: "#10B981",
  },
  {
    quote:
      "Parents now get real-time updates on their children's attendance. It's improved trust between the school and our parent community so much.",
    name: "Mr. Kofi Darko",
    role: "Administrator",
    school: "Grace International School, Tema",
    initials: "KD",
    color: "#F59E0B",
  },
];

export default function Testimonials() {
  return (
    <section
      className="relative w-full py-24 lg:py-32 overflow-hidden"
      style={{ background: "#0f0d1a" }}
    >
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 20% 50%, rgba(91,79,233,0.12) 0%, transparent 55%), radial-gradient(ellipse at 80% 50%, rgba(139,127,245,0.08) 0%, transparent 55%)" }} />

      {/* Subtle grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">

        {/* Header */}
        <motion.div
          className="text-center max-w-xl mx-auto mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-8 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
            <span className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.18em" }}>
              From the schools
            </span>
            <div className="h-px w-8 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
          </div>

          <h2 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-4"
            style={{ fontFamily: "'Sora', sans-serif", color: "white" }}>
            Schools love
            <br />
            <span style={{ background: "linear-gradient(135deg, #8B7FF5 0%, #A855F7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              EduJay.
            </span>
          </h2>

          <p className="text-base text-white/50 leading-relaxed"
            style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
            Real feedback from administrators and teachers across Ghana.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              className="relative rounded-2xl p-7 flex flex-col gap-5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                backdropFilter: "blur(12px)",
              }}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4, borderColor: `${t.color}33`, transition: { duration: 0.2 } }}
            >
              {/* Top accent line */}
              <div className="absolute top-0 left-8 right-8 h-px rounded-full"
                style={{ background: `linear-gradient(90deg, transparent, ${t.color}55, transparent)` }} />

              {/* Quote mark */}
              <div className="text-5xl leading-none font-serif select-none"
                style={{ color: `${t.color}33`, fontFamily: "Georgia, serif", lineHeight: 0.8 }}>
                "
              </div>

              {/* Quote */}
              <p className="text-sm text-white/70 leading-relaxed flex-1"
                style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
                {t.quote}
              </p>

              {/* Divider */}
              <div className="h-px w-full" style={{ background: "rgba(255,255,255,0.06)" }} />

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${t.color}99, ${t.color}55)`, border: `1px solid ${t.color}44` }}>
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white" style={{ fontFamily: "'Sora', sans-serif" }}>
                    {t.name}
                  </div>
                  <div className="text-xs text-white/40" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {t.role} · {t.school}
                  </div>
                </div>
              </div>

              {/* Star rating */}
              <div className="flex items-center gap-1 absolute top-7 right-7">
                {Array.from({ length: 5 }).map((_, s) => (
                  <svg key={s} width="12" height="12" viewBox="0 0 24 24" fill={t.color} opacity={0.8}>
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}