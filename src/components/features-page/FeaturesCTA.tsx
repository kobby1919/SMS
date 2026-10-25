"use client";

import { motion } from "framer-motion";

export default function FeaturesCTA() {
  return (
    <section id="features-access" className="relative w-full py-24 lg:py-32 overflow-hidden" style={{ background: "#080B18" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 72% 80% at 22% 42%, rgba(32,44,92,0.6) 0%, rgba(16,19,28,0.76) 52%, #10131C 100%)" }} />

      <div className="relative max-w-3xl mx-auto px-6 lg:px-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-5"
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Let&apos;s plan the right setup
            <br />
            <span style={{ background: "linear-gradient(135deg, #8B7FF5 0%, #A855F7 60%, #FB7185 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              for your school.
            </span>
          </h2>
          <p className="text-base text-white/50 leading-relaxed mb-10 max-w-lg mx-auto"
            style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
            Discuss your school&apos;s needs, package, and onboarding scope before your team begins.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <motion.a href="/waitlist"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-sm"
              style={{ background: "linear-gradient(135deg, #5B4FE9, #A855F7)", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 8px 30px #8B7FF540" }}
              whileHover={{ y: -2, boxShadow: "0 14px 40px #8B7FF550" }}
              whileTap={{ y: 0 }}
              transition={{ duration: 0.2 }}>
              Request School Access
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M13 6L19 12L13 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.a>
            <motion.a href="/#how-it-works"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white/60 font-medium text-sm border border-white/12"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
              whileHover={{ y: -2, borderColor: "rgba(139,127,245,0.4)", color: "rgba(255,255,255,0.9)" }}
              whileTap={{ y: 0 }}
              transition={{ duration: 0.2 }}>
              How Onboarding Works
            </motion.a>
          </div>
          <p className="mt-6 text-xs text-white/25" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Built for Ghanaian schools. Start fresh or bring existing records.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
