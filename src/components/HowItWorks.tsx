"use client";

import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import type { ReactNode } from "react";

// ── Brand tokens (matches hero) ───────────────────────────────────────────────
const B = {
  blue:      "#5B4FE9",
  blueLight: "#8B7FF5",
  navy:      "#0D0B2B",
  ink:       "#080B18",
  green:     "#10B981",
  amber:     "#F59E0B",
};

// ── Step data ────────────────────────────────────────────────────────────────
type Step = {
  number: string;
  label: string;
  title: string;
  body: string;
  color: string;
  details: string[];
  icon: ReactNode;
};

const STEPS: Step[] = [
  {
    number: "01",
    label: "Foundation",
    title: "Set Up Your School",
    body: "Configure your school profile, academic year, terms, classes, and subjects in minutes. EduJay adapts to your school's structure — from Nursery all the way to JHS 3.",
    color: B.blueLight,
    details: ["Academic year & terms", "Classes & sections", "Subjects & curriculum"],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 9L12 2L21 9V20C21 20.6 20.6 21 20 21H15V15H9V21H4C3.4 21 3 20.6 3 20V9Z"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    number: "02",
    label: "People",
    title: "Add Your People",
    body: "Onboard teachers, students, and parents with ease. Assign roles, link parents to students, and let Clerk handle secure authentication for everyone.",
    color: B.green,
    details: ["Teachers & admins", "Students & classes", "Parents & guardians"],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M17 21V19C17 16.8 15.2 15 13 15H5C2.8 15 1 16.8 1 19V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M23 21V19C23 17.1 21.7 15.5 20 15.1M16 3.1C17.7 3.5 19 5.1 19 7C19 8.9 17.7 10.5 16 10.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    number: "03",
    label: "Operations",
    title: "Run Everything",
    body: "Mark attendance, enter grades, publish timetables, track fees, and generate results — all from one clean dashboard. Every role sees exactly what they need.",
    color: B.amber,
    details: ["Attendance & grading", "Timetables & results", "Fees & reports"],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 3L4 7V12C4 16.4 7.4 20.5 12 21.5C16.6 20.5 20 16.4 20 12V7L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

// ── Single step row ───────────────────────────────────────────────────────────
function StepRow({ step, index, isLast }: { step: Step; index: number; isLast: boolean }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -24 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.65, delay: index * 0.18, ease: [0.22, 1, 0.36, 1] }}
      style={{ display: "flex", gap: 0, position: "relative" }}
    >
      {/* ── Left: big number column ── */}
      <div style={{
        width: 120,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        paddingTop: 4,
      }}>
        {/* Giant watermark number */}
        <div style={{
          fontFamily: "'Sora', sans-serif",
          fontSize: "clamp(5rem, 9vw, 7.5rem)",
          fontWeight: 900,
          lineHeight: 1,
          color: `${step.color}14`,
          letterSpacing: "-0.05em",
          userSelect: "none",
          position: "absolute",
          top: -8,
          left: -8,
          zIndex: 0,
        }}>
          {step.number}
        </div>

        {/* Icon badge — sits over the watermark */}
        <div style={{
          position: "relative",
          zIndex: 1,
          width: 48,
          height: 48,
          borderRadius: 14,
          background: `${step.color}14`,
          border: `1.5px solid ${step.color}35`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: step.color,
          boxShadow: `0 0 24px ${step.color}18`,
          marginTop: 8,
        }}>
          {step.icon}
        </div>

        {/* Connecting spine */}
        {!isLast && (
          <motion.div
            initial={{ scaleY: 0 }}
            animate={inView ? { scaleY: 1 } : {}}
            transition={{ duration: 0.7, delay: index * 0.18 + 0.4, ease: "easeOut" }}
            style={{
              position: "relative",
              zIndex: 1,
              width: 1,
              flex: 1,
              minHeight: 48,
              marginTop: 10,
              background: `linear-gradient(180deg, ${step.color}50, ${STEPS[index + 1].color}20)`,
              transformOrigin: "top",
            }}
          />
        )}
      </div>

      {/* ── Right: content ── */}
      <div style={{
        flex: 1,
        paddingBottom: isLast ? 0 : "clamp(40px, 6vh, 64px)",
        paddingLeft: "clamp(16px, 3vw, 36px)",
        paddingTop: 4,
      }}>
        {/* Step label */}
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: step.color,
          marginBottom: 10,
          opacity: 0.9,
        }}>
          Step {step.number} — {step.label}
        </div>

        {/* Title */}
        <h3 style={{
          fontFamily: "'Clash Display', sans-serif",
          fontSize: "clamp(1.5rem, 3vw, 2.1rem)",
          fontWeight: 800,
          color: "#F0F2FF",
          lineHeight: 1.12,
          letterSpacing: "-0.025em",
          marginBottom: 14,
        }}>
          {step.title}
        </h3>

        {/* Body */}
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "clamp(0.9rem, 1.3vw, 1rem)",
          fontWeight: 300,
          color: "rgba(220,224,255,0.52)",
          lineHeight: 1.85,
          maxWidth: 520,
          marginBottom: 20,
        }}>
          {step.body}
        </p>

        {/* Detail chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {step.details.map((d) => (
            <span key={d} style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 13px",
              borderRadius: 999,
              background: `${step.color}0e`,
              border: `1px solid ${step.color}28`,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              fontWeight: 500,
              color: step.color,
              letterSpacing: "0.02em",
            }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                <path d="M5 13L9 17L19 7" stroke={step.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {d}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Dark blue background (matches hero) ──────────────────────────────────────
function DarkBlueBg() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        background:
          "radial-gradient(ellipse 72% 80% at 22% 42%, rgba(32,44,92,0.6) 0%, rgba(16,19,28,0.76) 52%, #10131C 100%)",
        pointerEvents: "none",
      }}
    />
  );
}

// ── Main section ──────────────────────────────────────────────────────────────
export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      style={{
        position: "relative",
        width: "100%",
        background: B.ink,
        overflow: "hidden",
        padding: "clamp(80px, 14vh, 128px) 0",
        isolation: "isolate",
      }}
    >
      {/* ── Dark blue background (matches hero) ── */}
      <DarkBlueBg />

      <div style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 1100,
        margin: "0 auto",
        padding: "0 clamp(24px, 6vw, 80px)",
      }}>

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginBottom: "clamp(52px, 8vh, 80px)" }}
        >
          {/* Eyebrow */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
          }}>
            <div style={{ height: 1, width: 32, background: `${B.blueLight}50`, borderRadius: 1 }} />
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: `${B.blueLight}90`,
            }}>
              Simple by design
            </span>
          </div>

          {/* Two-column header layout */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "clamp(24px, 4vw, 60px)",
            alignItems: "end",
          }}
          className="hiw-header-grid"
          >
            <h2 style={{
              fontFamily: "'Clash Display', sans-serif",
              fontWeight: 800,
              fontSize: "clamp(2.4rem, 4.5vw, 3.8rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "#fff",
              margin: 0,
            }}>
              Up and running{" "}
              <br />
              <span style={{
                background: `linear-gradient(135deg, ${B.blueLight} 0%, ${B.green} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                in three steps.
              </span>
            </h2>

            <div>
              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "clamp(0.95rem, 1.3vw, 1.05rem)",
                fontWeight: 300,
                color: "rgba(200,204,255,0.5)",
                lineHeight: 1.85,
                margin: 0,
              }}>
                No lengthy onboarding. No IT team required. EduJay is designed so any school administrator can get started today — and be fully operational by tomorrow.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Divider ── */}
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{
            height: 1,
            background: `linear-gradient(90deg, ${B.blueLight}30, ${B.green}20, transparent)`,
            marginBottom: "clamp(48px, 7vh, 72px)",
            transformOrigin: "left",
          }}
        />

        {/* ── Steps ── */}
        <div>
          {STEPS.map((step, i) => (
            <StepRow key={step.number} step={step} index={i} isLast={i === STEPS.length - 1} />
          ))}
        </div>

        {/* ── Bottom CTA bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.55, delay: 0.2 }}
          style={{
            marginTop: "clamp(48px, 7vh, 72px)",
            padding: "clamp(24px, 3vw, 36px) clamp(24px, 3vw, 40px)",
            borderRadius: 20,
            background: "rgba(255,255,255,0.035)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 20,
            backdropFilter: "blur(8px)",
          }}
        >
          <div>
            <div style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: "clamp(1rem, 1.6vw, 1.2rem)",
              fontWeight: 700,
              color: "#F0F2FF",
              marginBottom: 4,
            }}>
              Ready to modernize how your school operates?
            </div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              color: "rgba(200,204,255,0.4)",
            }}>
              Join schools across Ghana already running on EduJay.
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href="/sign-up"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 26px",
                borderRadius: 12,
                background: `linear-gradient(135deg, ${B.blue}, ${B.blueLight})`,
                color: "#fff",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: `0 4px 20px ${B.blue}40`,
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 8px 28px ${B.blue}55`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 4px 20px ${B.blue}40`;
              }}
            >
              Get Started Free
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M13 6L19 12L13 18" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <a
              href="/features"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 22px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                color: "rgba(220,224,255,0.7)",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                border: "1px solid rgba(255,255,255,0.1)",
                transition: "background 0.2s ease, color 0.2s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.1)";
                (e.currentTarget as HTMLAnchorElement).style.color = "#fff";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
                (e.currentTarget as HTMLAnchorElement).style.color = "rgba(220,224,255,0.7)";
              }}
            >
              See all features
            </a>
          </div>
        </motion.div>
      </div>

      {/* Responsive overrides */}
      <style>{`
        @media (max-width: 768px) {
          .hiw-header-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
