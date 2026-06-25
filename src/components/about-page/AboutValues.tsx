"use client";

import { motion } from "framer-motion";

const values = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 3L4 7V12C4 16.4 7.4 20.5 12 21.5C16.6 20.5 20 16.4 20 12V7L12 3Z"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Reliability first",
    description: "Schools depend on EduJay every single day. Attendance must save. Grades must compute correctly. Results must print. We treat reliability as a non-negotiable — not a feature.",
    color: "#8B7FF5",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Simplicity over complexity",
    description: "The best software is the software people actually use. We obsess over making every workflow as simple as possible — because a headmistress shouldn't need training to run a report.",
    color: "#10B981",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M17 21V19C17 16.8 15.2 15 13 15H5C2.8 15 1 16.8 1 19V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M23 21V19C23 17.1 21.7 15.5 20 15.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 3.1C17.7 3.5 19 5.1 19 7C19 8.9 17.7 10.5 16 10.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Built around people",
    description: "Teachers, bursars, parents, students — EduJay is shaped by how real people in Ghanaian schools actually work, not by assumptions made in a boardroom far removed from the classroom.",
    color: "#F59E0B",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 3H21V21H3V3Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 9H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9 21V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    title: "Local by design",
    description: "Ghana's school system has its own structure, its own rhythms, its own terminology. EduJay speaks that language — from Nursery to JHS 3, Term 1 to Term 3, GH₵ to cedis.",
    color: "#FB7185",
  },
];

export default function AboutValues() {
  return (
    <section id="values" className="relative w-full py-24 lg:py-32 overflow-hidden" style={{ background: "white" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 20% 50%, #F59E0B06 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, #8B7FF506 0%, transparent 50%)" }} />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">

        <motion.div
          className="text-center max-w-xl mx-auto mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-8 bg-gray-200 rounded-full" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400"
              style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.18em" }}>
              What drives us
            </span>
            <div className="h-px w-8 bg-gray-200 rounded-full" />
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4"
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Our core
            <span style={{ background: "linear-gradient(135deg, #8B7FF5 0%, #A855F7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}> values.</span>
          </h2>
          <p className="text-base text-gray-500 leading-relaxed"
            style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
            These aren&apos;t statements on a wall. They&apos;re the decisions we make every day
            when we&apos;re building EduJay.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {values.map((v, i) => (
            <motion.div
              key={v.title}
              className="group rounded-2xl p-8"
              style={{ background: `${v.color}06`, border: `1px solid ${v.color}18` }}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: `${v.color}12`, border: `1px solid ${v.color}24`, color: v.color }}>
                {v.icon}
              </div>
              <h3 className="text-xl font-extrabold text-gray-900 mb-3"
                style={{ fontFamily: "'Sora', sans-serif" }}>
                {v.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed"
                style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
                {v.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
