"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function AboutHero() {
  return (
    <section
      id="about-overview"
      className="relative w-full overflow-hidden pt-36 pb-16"
      style={{ background: "#17191b", isolation: "isolate" }}
    >
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(110deg, rgba(139,127,245,0.045) 0%, rgba(139,127,245,0.015) 36%, transparent 70%)" }} />

{/* Font Imports: Added Fontshare's CDN for Clash Display */}
<style>{`
  @import url('https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap');
`}</style>
      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        <motion.div
          className="max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-5">
            <Link href="/" className="text-xs text-white/30 hover:text-white/60 transition-colors duration-200"
              style={{ fontFamily: "var(--font-body)" }}>Home</Link>
            <span className="text-white/20 text-xs">/</span>
            <span className="text-xs" style={{ color: "#8B7FF5", fontFamily: "var(--font-body)" }}>About</span>
          </div>

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
            style={{ background: "rgba(139,127,245,0.1)", border: "1px solid rgba(139,127,245,0.2)" }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#8B7FF5" }} />
            <span className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#8B7FF5", fontFamily: "var(--font-body)", letterSpacing: "0.14em" }}>
              About Edujay
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4"
            style={{ fontFamily: "var(--font-heading)" }}>
            School management,
            <span style={{ background: "linear-gradient(135deg, #8B7FF5 0%, #A855F7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}> built around the people doing the work.</span>
          </h1>

          <p className="text-sm lg:text-base text-white/65 leading-relaxed mb-8 max-w-lg"
            style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}>
            Edujay is a school management platform developed by MiqraTech Consult,
            designed around the academic, administrative, and financial work of Ghanaian schools.
          </p>

          <a href="/howItWorks"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #5B4FE9, #8B7FF5)", fontFamily: "var(--font-body)", boxShadow: "0 6px 24px #8B7FF535" }}>
            Explore How Edujay Works
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M13 6L19 12L13 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </motion.div>

        {/* Anchor pills */}
        <motion.div
          className="flex flex-wrap items-center gap-2 mt-10 pt-8 border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <span className="text-[10px] text-white/25 mr-1 uppercase tracking-widest"
            style={{ fontFamily: "var(--font-body)" }}>Jump to</span>
          {[
            { label: "Our Purpose", href: "#mission", color: "#8B7FF5" },
            { label: "Our Approach", href: "#story", color: "#10B981" },
            { label: "Our Principles", href: "#values", color: "#F59E0B" },
            { label: "The Team",    href: "#team",    color: "#60A5FA" },
          ].map((f) => (
            <a key={f.label} href={f.href}
              className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 hover:scale-105"
              style={{ background: `${f.color}12`, border: `1px solid ${f.color}25`, color: f.color, fontFamily: "var(--font-body)" }}>
              {f.label}
            </a>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
