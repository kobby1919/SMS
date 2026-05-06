"use client";

import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import type { ReactNode } from "react";
import Image from "next/image";

const callouts = [
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M9 11L12 14L22 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: "Live attendance marking",
    color: "#10B981",
    position: "top-[12%] -left-[2%] lg:-left-[6%]",
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <line x1="18" y1="20" x2="18" y2="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="12" y1="20" x2="12" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="6" y1="20" x2="6" y2="14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="2" y1="20" x2="22" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    label: "Auto grade computation",
    color: "#F59E0B",
    position: "top-[12%] -right-[2%] lg:-right-[6%]",
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M6 15H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 15H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    label: "Fee payment tracking",
    color: "#FB7185",
    position: "bottom-[14%] -left-[2%] lg:-left-[6%]",
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    label: "Conflict-free timetables",
    color: "#8B7FF5",
    position: "bottom-[14%] -right-[2%] lg:-right-[6%]",
  },
];

export default function DashboardPreview() {
  return (
    <section
      className="relative w-full py-24 lg:py-32 overflow-hidden"
      style={{ background: "white" }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 60%, #8B7FF510 0%, transparent 65%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">

        {/* Header */}
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-8 bg-gray-200 rounded-full" />
            <span
              className="text-xs font-semibold uppercase tracking-widest text-gray-400"
              style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.18em" }}
            >
              Built for clarity
            </span>
            <div className="h-px w-8 bg-gray-200 rounded-full" />
          </div>

          <h2
            className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            See it in
            <br />
            <span style={{
              background: "linear-gradient(135deg, #5B4FE9 0%, #8B7FF5 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              action.
            </span>
          </h2>

          <p
            className="text-base lg:text-lg text-gray-500 leading-relaxed"
            style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}
          >
            A clean, role-aware dashboard that gives every user exactly what they need —
            no clutter, no confusion.
          </p>
        </motion.div>

        {/* Browser mockup + callout chips */}
        <motion.div
          className="relative mx-auto"
          style={{ maxWidth: "960px" }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Purple glow beneath */}
          <div
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-24 blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(ellipse, #8B7FF533 0%, transparent 70%)" }}
          />

          {/* Callout chips */}
          {callouts.map((c, i) => (
            <motion.div
              key={c.label}
              className={`absolute hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl z-10 ${c.position}`}
              style={{
                background: "white",
                border: `1px solid ${c.color}22`,
                boxShadow: `0 4px 20px ${c.color}18, 0 1px 4px rgba(0,0,0,0.06)`,
              }}
              initial={{ opacity: 0, scale: 0.85 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
            >
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${c.color}14`, color: c.color }}
              >
                {c.icon}
              </div>
              <span
                className="text-xs font-medium text-gray-700 whitespace-nowrap"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {c.label}
              </span>
            </motion.div>
          ))}

          {/* The browser frame containing the actual image screenshot */}
          <div
            className="w-full rounded-2xl overflow-hidden"
            style={{
              boxShadow: "0 40px 100px rgba(91,79,233,0.18), 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            {/* Browser chrome bar */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ background: "#1a1730", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md mx-4"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'DM Sans', sans-serif" }}>
                  app.edujay.com/dashboard
                </span>
              </div>
            </div>

            {/* Real screenshot */}
            <Image
              src="/dashboard-preview.png"
              alt="SchoolJay Dashboard"
              width={1280}
              height={720}
              className="w-full"
              priority
            />
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          className="mt-14 flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="text-sm text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Your real dashboard will look just like this — populated with your school's data.
          </p>
          <a
            href="/sign-up"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-white text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg, #5B4FE9 0%, #8B7FF5 100%)",
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: "0 4px 20px #8B7FF530",
            }}
          >
            Try it yourself
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M13 6L19 12L13 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
}