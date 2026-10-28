"use client";

import { motion } from "framer-motion";

export default function CTABanner() {
  return (
    <section id="school-access" className="relative w-full py-24 lg:py-32 overflow-hidden" style={{ background: "#f8f7ff" }}>

      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 100%, #8B7FF518 0%, transparent 60%)" }} />

      {/* Dot grid */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, #8B7FF520 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative max-w-4xl mx-auto px-6 lg:px-10 text-center">

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
            style={{ background: "#8B7FF514", border: "1px solid #8B7FF530" }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#8B7FF5" }} />
            <span className="text-xs font-semibold" style={{ color: "#8B7FF5", fontFamily: "var(--font-body)", letterSpacing: "0.1em" }}>
              LET&apos;S TALK ABOUT YOUR SCHOOL
            </span>
          </div>

          {/* Heading */}
          <h2 className="text-4xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6"
            style={{ fontFamily: "var(--font-heading)" }}>
            Your school&apos;s next chapter,
            <br />
            <span style={{ background: "linear-gradient(135deg, #5B4FE9 0%, #A855F7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              with Edujay.
            </span>
          </h2>

          {/* Subtext */}
          <p className="text-base lg:text-lg text-gray-500 leading-relaxed mb-10 max-w-xl mx-auto"
            style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}>
            Tell us about your school and what you need to manage. We&apos;ll discuss
            the package, agree the onboarding scope, and guide you through the next steps.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <motion.a
              href="/request-access"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-sm"
              style={{
                background: "linear-gradient(135deg, #5B4FE9 0%, #A855F7 100%)",
                fontFamily: "var(--font-body)",
                boxShadow: "0 8px 30px #8B7FF540",
              }}
              whileHover={{ y: -2, boxShadow: "0 14px 40px #8B7FF550" }}
              whileTap={{ y: 0 }}
              transition={{ duration: 0.2 }}
            >
              Request School Access
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M13 6L19 12L13 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.a>

            <motion.a
              href="/howItWorks"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-gray-700 font-medium text-sm border border-gray-200"
              style={{ fontFamily: "var(--font-body)", background: "white" }}
              whileHover={{ y: -2, borderColor: "#8B7FF544", boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}
              whileTap={{ y: 0 }}
              transition={{ duration: 0.2 }}
            >
              How Onboarding Works
            </motion.a>
          </div>

          {/* Trust note */}
          <p className="mt-8 text-xs text-gray-400" style={{ fontFamily: "var(--font-body)" }}>
            Built for Ghanaian schools. Start fresh or bring existing records.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
