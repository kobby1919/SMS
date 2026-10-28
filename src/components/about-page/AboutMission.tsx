"use client";

import { motion } from "framer-motion";

const priorities = [
  { title: "Connected records", description: "Bring related school information into a shared structure.", color: "#8B7FF5" },
  { title: "Clear responsibilities", description: "Match access and tasks to each person's role.", color: "#10B981" },
  { title: "Reviewed information", description: "Check records and figures before relying on them.", color: "#F59E0B" },
  { title: "Guided setup", description: "Prepare the school and its records before daily use.", color: "#FB7185" },
];

export default function AboutMission() {
  return (
    <section id="mission" className="relative w-full py-24 lg:py-32 overflow-hidden scroll-mt-20" style={{ background: "white" }}>
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
                style={{ fontFamily: "var(--font-body)", letterSpacing: "0.18em" }}>
                Our Purpose
              </span>
            </div>

            <h2 className="text-3xl min-[360px]:text-4xl xl:text-5xl font-extrabold text-gray-900 leading-tight mb-6"
              style={{ fontFamily: "var(--font-heading)" }}>
              Connect the work.
              <br />
              <span style={{ background: "linear-gradient(135deg, #8B7FF5 0%, #A855F7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Support the people.
              </span>
            </h2>

            <div className="flex flex-col gap-4">
              <p className="text-base text-gray-500 leading-relaxed"
                style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}>
                When records sit across separate books, spreadsheets, and conversations,
                keeping information consistent takes extra effort. Edujay aims to connect
                that work so school teams can record, review, and follow up more clearly.
              </p>
              <p className="text-base text-gray-500 leading-relaxed"
                style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}>
                Our purpose is to support the people responsible for school administration,
                teaching, finance, and parent communication, with tools organised around
                their responsibilities and the records they need.
              </p>
              <p className="text-base text-gray-500 leading-relaxed"
                style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}>
                Developed by MiqraTech Consult, Edujay brings school records, attendance,
                assessments, and fee management into a connected platform, with guided
                setup and review before a school begins daily work.
              </p>
            </div>
          </motion.div>

          {/* Product priorities, not adoption statistics. */}
          <motion.div
            className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-4 min-w-0"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            {priorities.map((s, i) => (
              <motion.div
                key={s.title}
                className="rounded-2xl p-5 flex flex-col gap-2 min-w-0"
                style={{ background: `${s.color}08`, border: `1px solid ${s.color}18` }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <h3 className="text-base font-bold leading-snug" style={{ color: s.color, fontFamily: "var(--font-heading)" }}>
                  {s.title}
                </h3>
                <div className="text-sm text-gray-500" style={{ fontFamily: "var(--font-body)" }}>
                  {s.description}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
