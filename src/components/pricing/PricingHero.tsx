"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function PricingHero() {
  return (
    <section
      id="pricing-overview"
      className="relative w-full overflow-hidden pt-36 pb-16"
      style={{ background: "#080B18", isolation: "isolate" }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 72% 80% at 22% 42%, rgba(32,44,92,0.6) 0%, rgba(16,19,28,0.76) 52%, #10131C 100%)",
        }}
      />

      <style>{`@import url('https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');`}</style>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        <motion.div
          className="max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-5">
            <Link
              href="/"
              className="text-xs text-white/30 hover:text-white/60 transition-colors duration-200"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Home
            </Link>
            <span className="text-white/20 text-xs">/</span>
            <span
              className="text-xs"
              style={{ color: "#8B7FF5", fontFamily: "'DM Sans', sans-serif" }}
            >
              Pricing
            </span>
          </div>

          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
            style={{
              background: "rgba(139,127,245,0.1)",
              border: "1px solid rgba(139,127,245,0.2)",
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#8B7FF5" }}
            />
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{
                color: "#8B7FF5",
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: "0.14em",
              }}
            >
              Annual School Package
            </span>
          </div>

          <h1
            className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            One school package.
            <span
              style={{
                background: "linear-gradient(135deg, #8B7FF5 0%, #A855F7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {" "}
              Clear costs before you begin.
            </span>
          </h1>

          <p
            className="text-sm lg:text-base text-white/65 leading-relaxed mb-8 max-w-lg"
            style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}
          >
            Discuss your school&apos;s size, setup needs, and existing records with us.
            We&apos;ll provide an annual package quotation and agree the onboarding
            scope before work begins.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/request-access"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background: "linear-gradient(135deg, #5B4FE9, #8B7FF5)",
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: "0 6px 24px #8B7FF535",
              }}
            >
              Request a School Quote
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12H19M13 6L19 12L13 18"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
            <a
              href="#package-details"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white/60 text-sm font-medium border border-white/12 transition-all duration-300 hover:border-white/25 hover:text-white/80"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              What the Package Covers
            </a>
          </div>
        </motion.div>

        {/* Trust pills */}
        <motion.div
          className="flex flex-wrap items-center gap-2 mt-10 pt-8 border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          {[
            { text: "Annual package", color: "#10B981" },
            { text: "Scope agreed upfront", color: "#8B7FF5" },
            { text: "Optional costs disclosed", color: "#F59E0B" },
            { text: "School fees kept separate", color: "#60A5FA" },
          ].map((p) => (
            <div
              key={p.text}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{
                background: `${p.color}10`,
                border: `1px solid ${p.color}22`,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 13L9 17L19 7"
                  stroke={p.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                className="text-[11px] font-medium"
                style={{ color: p.color, fontFamily: "'DM Sans', sans-serif" }}
              >
                {p.text}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
