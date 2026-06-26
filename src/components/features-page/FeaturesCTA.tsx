"use client";

import { motion } from "framer-motion";

export default function FeaturesCTA() {
  return (
    <section className="relative w-full py-24 lg:py-32 overflow-hidden" style={{ background: "#0a0916" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(91,79,233,0.15) 0%, transparent 60%)" }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="relative max-w-3xl mx-auto px-6 lg:px-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-5"
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            All of this,
            <br />
            <span style={{ background: "linear-gradient(135deg, #8B7FF5 0%, #A855F7 60%, #FB7185 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              from day one.
            </span>
          </h2>
          <p className="text-base text-white/50 leading-relaxed mb-10 max-w-lg mx-auto"
            style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
            No modules to unlock. No upgrade walls. Every feature shown here is available
            the moment you set up your school on Edujay.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <motion.a href="/sign-up"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-sm"
              style={{ background: "linear-gradient(135deg, #5B4FE9, #A855F7)", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 8px 30px #8B7FF540" }}
              whileHover={{ y: -2, boxShadow: "0 14px 40px #8B7FF550" }}
              whileTap={{ y: 0 }}
              transition={{ duration: 0.2 }}>
              Get Started Free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M13 6L19 12L13 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.a>
            <motion.a href="/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white/60 font-medium text-sm border border-white/12"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
              whileHover={{ y: -2, borderColor: "rgba(139,127,245,0.4)", color: "rgba(255,255,255,0.9)" }}
              whileTap={{ y: 0 }}
              transition={{ duration: 0.2 }}>
              View Pricing
            </motion.a>
          </div>
          <p className="mt-6 text-xs text-white/25" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            No credit card required · Ghana-built · Works on any device
          </p>
        </motion.div>
      </div>
    </section>
  );
}