"use client";

import { motion } from "framer-motion";

export default function PricingHero() {
  return (
    <section
      className="relative w-full overflow-hidden pt-36 pb-16"
      style={{ background: "#0a0916" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(91,79,233,0.14) 0%, transparent 55%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
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
            <a
              href="/"
              className="text-xs text-white/30 hover:text-white/60 transition-colors duration-200"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Home
            </a>
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
              Simple Pricing
            </span>
          </div>

          <h1
            className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Honest pricing for
            <span
              style={{
                background: "linear-gradient(135deg, #8B7FF5 0%, #A855F7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {" "}
              every school.
            </span>
          </h1>

          <p
            className="text-sm lg:text-base text-white/45 leading-relaxed mb-8 max-w-lg"
            style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}
          >
            Start free. Grow at your own pace. No hidden fees, no surprise
            charges — just transparent, straightforward pricing built around
            Ghanaian schools.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#plans"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background: "linear-gradient(135deg, #5B4FE9, #8B7FF5)",
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: "0 6px 24px #8B7FF535",
              }}
            >
              See Plans
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
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white/60 text-sm font-medium border border-white/12 transition-all duration-300 hover:border-white/25 hover:text-white/80"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Talk to us
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
            { text: "Free plan available", color: "#10B981" },
            { text: "No credit card required", color: "#8B7FF5" },
            { text: "Cancel anytime", color: "#F59E0B" },
            { text: "Ghana-based support", color: "#60A5FA" },
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
