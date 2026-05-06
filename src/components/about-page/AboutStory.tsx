"use client";

import { motion } from "framer-motion";

const timeline = [
  {
    year: "2024",
    title: "The frustration",
    description: "A chance conversation with a school administrator in Accra revealed what we already suspected — most schools were drowning in manual processes. Attendance books, Excel gradesheets, paper fee receipts. We started asking questions.",
    color: "#8B7FF5",
  },
  {
    year: "Early 2025",
    title: "Building the foundation",
    description: "We spent months embedded with teachers, bursars, and headmasters across Accra and Kumasi. We watched how they actually worked — not how we assumed they did. EduJay's first modules were shaped entirely by those conversations.",
    color: "#10B981",
  },
  {
    year: "Mid 2025",
    title: "First schools go live",
    description: "The first three schools started using EduJay in Term 2. Teachers marked attendance on their phones for the first time. A bursar generated a full term financial report in under a minute. The feedback was immediate — and honest.",
    color: "#F59E0B",
  },
  {
    year: "2026",
    title: "Growing across Ghana",
    description: "EduJay now serves schools across Greater Accra, Ashanti, and Central regions. We're building the bursar dashboard, expanding result reporting, and working toward a parent mobile experience. The mission hasn't changed.",
    color: "#FB7185",
  },
];

export default function AboutStory() {
  return (
    <section id="story" className="relative w-full py-24 lg:py-32 overflow-hidden" style={{ background: "#f8f7ff" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, #8B7FF518 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.5 }} />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">

        {/* Header */}
        <motion.div
          className="max-w-xl mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px w-8 bg-gray-300 rounded-full" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400"
              style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.18em" }}>
              Our Story
            </span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4"
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            How EduJay
            <br />
            <span style={{ background: "linear-gradient(135deg, #8B7FF5 0%, #10B981 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              came to life.
            </span>
          </h2>
          <p className="text-base text-gray-500 leading-relaxed"
            style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
            Not a startup idea from a pitch deck — a solution born from watching real schools
            struggle with problems that software could solve.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 lg:left-1/2 top-0 bottom-0 w-px"
            style={{ background: "linear-gradient(to bottom, #8B7FF533, #FB718533)", transform: "translateX(-50%)" }} />

          <div className="flex flex-col gap-12">
            {timeline.map((item, i) => (
              <motion.div
                key={item.year}
                className={`relative flex flex-col lg:flex-row items-start gap-8 ${i % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Content */}
                <div className={`flex-1 pl-14 lg:pl-0 ${i % 2 === 0 ? "lg:pr-16 lg:text-right" : "lg:pl-16"}`}>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3"
                    style={{ background: `${item.color}12`, border: `1px solid ${item.color}25` }}>
                    <span className="text-xs font-bold" style={{ color: item.color, fontFamily: "'Sora', sans-serif" }}>
                      {item.year}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-gray-900 mb-2"
                    style={{ fontFamily: "'Sora', sans-serif" }}>
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed"
                    style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
                    {item.description}
                  </p>
                </div>

                {/* Center dot */}
                <div className="absolute left-6 lg:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white z-10 mt-1"
                  style={{ background: item.color, boxShadow: `0 0 0 4px ${item.color}22` }} />

                {/* Empty half for layout */}
                <div className="hidden lg:block flex-1" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}