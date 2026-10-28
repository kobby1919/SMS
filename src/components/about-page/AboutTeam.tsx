"use client";

import { motion } from "framer-motion";

const team = [
  { name: "Robert Ankrah", role: "Founder, MiqraTech Consult", bio: "Founder of MiqraTech Consult, the company behind Edujay. Provides the organisational and financial backing for the platform's development.", initials: "RA", color: "#10B981" },
  { name: "Samuel Kwabena Assan", role: "Creator & Lead Software Engineer, Edujay · MiqraTech Consult", bio: "Designed and built Edujay in its entirety. Leads the platform's architecture, software development, and technical direction.", initials: "SA", color: "#8B7FF5" },
  { name: "Yevgene Mawugbe", role: "Software Engineer, Edujay", bio: "Helped shape the original Edujay idea with Samuel Kwabena Assan. His role focuses on supporting future development and improvements.", initials: "YM", color: "#F59E0B" },
  { name: "Harriet", role: "Administration Coordinator, MiqraTech Consult", bio: "Handles administrative coordination at MiqraTech Consult, supporting the company's day-to-day work.", initials: "H", color: "#FB7185" },
];

export default function AboutTeam() {
  return (
    <section id="team" className="relative w-full py-24 lg:py-32 overflow-hidden scroll-mt-20" style={{ background: "#f0fdf8" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, #10B98118 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.5 }} />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">

        <motion.div
          className="text-center max-w-xl mx-auto mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-8 bg-gray-300 rounded-full" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400"
              style={{ fontFamily: "var(--font-body)", letterSpacing: "0.18em" }}>
              MiqraTech Consult
            </span>
            <div className="h-px w-8 bg-gray-300 rounded-full" />
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4"
            style={{ fontFamily: "var(--font-heading)" }}>
            The people
            <span style={{ background: "linear-gradient(135deg, #8B7FF5 0%, #10B981 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}> behind Edujay.</span>
          </h2>
          <p className="text-base text-gray-500 leading-relaxed"
            style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}>
            Edujay is developed by MiqraTech Consult. Meet the people behind its
            creation, backing, and administration.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {team.map((member, i) => (
            <motion.div
              key={member.name}
              className="rounded-2xl p-6 flex flex-col gap-4 min-w-0"
              style={{ background: "white", border: "1px solid #f1f1f3", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4, boxShadow: `0 12px 32px ${member.color}14`, transition: { duration: 0.2 } }}
            >
              {/* Avatar */}
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-extrabold text-white"
                style={{ background: `linear-gradient(135deg, ${member.color}cc, ${member.color}88)`, fontFamily: "var(--font-body)" }}>
                {member.initials}
              </div>

              <div>
                <div className="text-base font-extrabold text-gray-900 mb-0.5"
                  style={{ fontFamily: "var(--font-body)" }}>
                  {member.name}
                </div>
                <div className="text-xs font-semibold mb-3"
                  style={{ color: member.color, fontFamily: "var(--font-body)" }}>
                  {member.role}
                </div>
                <p className="text-sm text-gray-500 leading-relaxed"
                  style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}>
                  {member.bio}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Company and onboarding information */}
        <motion.div
          className="mt-12 flex flex-col sm:flex-row items-center justify-between p-6 rounded-2xl gap-4"
          style={{ background: "white", border: "1px solid #f1f1f3" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div>
            <div className="text-base font-extrabold text-gray-900 mb-1"
              style={{ fontFamily: "var(--font-body)" }}>
              Developed by MiqraTech Consult
            </div>
            <p className="text-sm text-gray-500" style={{ fontFamily: "var(--font-body)" }}>
              Discuss your school&apos;s needs, onboarding scope, and next steps before setup begins.
            </p>
          </div>
          <a href="/howItWorks"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold flex-shrink-0 transition-all duration-300 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #5B4FE9, #8B7FF5)", fontFamily: "var(--font-body)", boxShadow: "0 4px 20px #8B7FF530" }}>
            How Onboarding Works
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M13 6L19 12L13 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
