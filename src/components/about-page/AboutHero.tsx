"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function AboutHero() {
  return (
    <section
      className="relative w-full overflow-hidden pt-36 pb-16"
      style={{ background: "#0a0916" }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(91,79,233,0.14) 0%, transparent 55%)" }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

{/* Font Imports: Added Fontshare's CDN for Clash Display */}
<style>{`
  @import url('https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
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
              style={{ fontFamily: "'DM Sans', sans-serif" }}>Home</Link>
            <span className="text-white/20 text-xs">/</span>
            <span className="text-xs" style={{ color: "#8B7FF5", fontFamily: "'DM Sans', sans-serif" }}>About</span>
          </div>

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
            style={{ background: "rgba(139,127,245,0.1)", border: "1px solid rgba(139,127,245,0.2)" }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#8B7FF5" }} />
            <span className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#8B7FF5", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.14em" }}>
              Our Story
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4"
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Built in Ghana,
            <span style={{ background: "linear-gradient(135deg, #8B7FF5 0%, #A855F7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}> for Ghana.</span>
          </h1>

          <p className="text-sm lg:text-base text-white/45 leading-relaxed mb-8 max-w-lg"
            style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
            Edujay was born from a simple frustration — Ghanaian schools deserve better tools.
            We decided to build them.
          </p>

          <a href="/sign-up"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #5B4FE9, #8B7FF5)", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 6px 24px #8B7FF535" }}>
            Join us
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
            style={{ fontFamily: "'DM Sans', sans-serif" }}>Jump to</span>
          {[
            { label: "Our Mission", href: "#mission", color: "#8B7FF5" },
            { label: "Our Story",   href: "#story",   color: "#10B981" },
            { label: "Values",      href: "#values",  color: "#F59E0B" },
            { label: "The Team",    href: "#team",    color: "#60A5FA" },
          ].map((f) => (
            <a key={f.label} href={f.href}
              className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 hover:scale-105"
              style={{ background: `${f.color}12`, border: `1px solid ${f.color}25`, color: f.color, fontFamily: "'DM Sans', sans-serif" }}>
              {f.label}
            </a>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
