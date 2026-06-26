"use client";

import { motion } from "framer-motion";

const team = [
  {
    name: "Jay Mensah",
    role: "Founder & CEO",
    bio: "Former school administrator turned developer. Built Edujay after spending two years watching Ghanaian schools manage everything manually.",
    initials: "JM",
    color: "#8B7FF5",
  },
  {
    name: "Ama Boateng",
    role: "Head of Product",
    bio: "Spent 6 years teaching in Accra public schools. Every Edujay feature goes through her — if a teacher wouldn't use it, it doesn't ship.",
    initials: "AB",
    color: "#10B981",
  },
  {
    name: "Kweku Asante",
    role: "Lead Engineer",
    bio: "Full-stack developer with a passion for building resilient systems. Responsible for Edujay's infrastructure, performance, and reliability.",
    initials: "KA",
    color: "#F59E0B",
  },
  {
    name: "Efua Darko",
    role: "Head of Customer Success",
    bio: "Works directly with schools during onboarding and beyond. The reason schools describe Edujay support as 'the best they've ever experienced'.",
    initials: "ED",
    color: "#FB7185",
  },
];

export default function AboutTeam() {
  return (
    <section id="team" className="relative w-full py-24 lg:py-32 overflow-hidden" style={{ background: "#f0fdf8" }}>
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
              style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.18em" }}>
              The team
            </span>
            <div className="h-px w-8 bg-gray-300 rounded-full" />
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4"
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            The people
            <span style={{ background: "linear-gradient(135deg, #8B7FF5 0%, #10B981 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}> behind Edujay.</span>
          </h2>
          <p className="text-base text-gray-500 leading-relaxed"
            style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
            A small, focused team that cares deeply about education in Ghana.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {team.map((member, i) => (
            <motion.div
              key={member.name}
              className="rounded-2xl p-6 flex flex-col gap-4"
              style={{ background: "white", border: "1px solid #f1f1f3", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4, boxShadow: `0 12px 32px ${member.color}14`, transition: { duration: 0.2 } }}
            >
              {/* Avatar */}
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-extrabold text-white"
                style={{ background: `linear-gradient(135deg, ${member.color}cc, ${member.color}88)`, fontFamily: "'Sora', sans-serif" }}>
                {member.initials}
              </div>

              <div>
                <div className="text-base font-extrabold text-gray-900 mb-0.5"
                  style={{ fontFamily: "'Sora', sans-serif" }}>
                  {member.name}
                </div>
                <div className="text-xs font-semibold mb-3"
                  style={{ color: member.color, fontFamily: "'DM Sans', sans-serif" }}>
                  {member.role}
                </div>
                <p className="text-sm text-gray-500 leading-relaxed"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
                  {member.bio}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Hiring note */}
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
              style={{ fontFamily: "'Sora', sans-serif" }}>
              We&apos;re growing 🇬🇭
            </div>
            <p className="text-sm text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Passionate about education and technology in Ghana? We&apos;d love to hear from you.
            </p>
          </div>
          <a href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold flex-shrink-0 transition-all duration-300 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #5B4FE9, #8B7FF5)", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 20px #8B7FF530" }}>
            Get in touch
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M13 6L19 12L13 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
