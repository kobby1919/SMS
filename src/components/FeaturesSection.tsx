"use client";

import { useRef, useEffect, useState } from "react";
import type { ReactNode } from "react";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Feature = {
  id: number;
  label: string;
  title: string;
  color: string;
  icon: ReactNode;
  stat: string;
  statLabel: string;
};

// ─── DATA ─────────────────────────────────────────────────────────────────────

const features: Feature[] = [
  {
    id: 1,
    label: "Attendance",
    title: "Smart Attendance Tracking",
    color: "#10B981",
    stat: "4 statuses",
    statLabel: "Present · Absent · Late · Excused",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path
          d="M9 11L12 14L22 4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M21 12V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H16"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 2,
    label: "Grading & CA",
    title: "Flexible Grading System",
    color: "#F59E0B",
    stat: "30/70 · 50/50",
    statLabel: "Configurable CA splits",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path
          d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="14,2 14,8 20,8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="16"
          y1="13"
          x2="8"
          y2="13"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line
          x1="16"
          y1="17"
          x2="8"
          y2="17"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 3,
    label: "Timetable",
    title: "Conflict-Free Timetables",
    color: "#8B7FF5",
    stat: "Real-time",
    statLabel: "Conflict detection",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect
          x="3"
          y="4"
          width="18"
          height="18"
          rx="0"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="16"
          y1="2"
          x2="16"
          y2="6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line
          x1="8"
          y1="2"
          x2="8"
          y2="6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line
          x1="3"
          y1="10"
          x2="21"
          y2="10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M8 14H8.01M12 14H12.01M16 14H16.01M8 18H8.01M12 18H12.01M16 18H16.01"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 4,
    label: "Results",
    title: "Instant Result Reports",
    color: "#60A5FA",
    stat: "1-click",
    statLabel: "Printable term reports",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <line
          x1="18"
          y1="20"
          x2="18"
          y2="10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line
          x1="12"
          y1="20"
          x2="12"
          y2="4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line
          x1="6"
          y1="20"
          x2="6"
          y2="14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line
          x1="2"
          y1="20"
          x2="22"
          y2="20"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 5,
    label: "Finance",
    title: "Fees & Payments",
    color: "#FB7185",
    stat: "Auto-ledger",
    statLabel: "Paid · Pending · Overdue",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect
          x="2"
          y="5"
          width="20"
          height="14"
          rx="0"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="2"
          y1="10"
          x2="22"
          y2="10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M6 15H8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M12 15H16"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 6,
    label: "Role Access",
    title: "Built for Every Role",
    color: "#A855F7",
    stat: "4 roles",
    statLabel: "Admin · Teacher · Student · Parent",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path
          d="M17 21V19C17 16.8 15.2 15 13 15H5C2.8 15 1 16.8 1 19V21"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M23 21V19C23 17.1 21.7 15.5 20 15.1"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 3.1C17.7 3.5 19 5.1 19 7C19 8.9 17.7 10.5 16 10.9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

// ─── SVG SNAKE BORDER ─────────────────────────────────────────────────────────

function SnakeBorder({
  hovered,
  color,
  w,
  h,
}: {
  hovered: boolean;
  color: string;
  w: number;
  h: number;
}) {
  const dashRef = useRef<SVGRectElement>(null);
  const glowRef = useRef<SVGRectElement>(null);
  const posRef = useRef(0);
  const rafRef = useRef<number>(0);

  const PERIMETER = 2 * (w + h);
  const DASH_LEN = PERIMETER * 0.22;
  const SPEED = 5;

  useEffect(() => {
    if (hovered) {
      const tick = () => {
        posRef.current = (posRef.current + SPEED) % PERIMETER;
        const offset = PERIMETER - posRef.current;
        const da = `${DASH_LEN} ${PERIMETER - DASH_LEN}`;
        dashRef.current?.setAttribute("stroke-dasharray", da);
        dashRef.current?.setAttribute("stroke-dashoffset", String(offset));
        glowRef.current?.setAttribute("stroke-dasharray", da);
        glowRef.current?.setAttribute("stroke-dashoffset", String(offset));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
      dashRef.current?.setAttribute("stroke-dasharray", "0 9999");
      glowRef.current?.setAttribute("stroke-dasharray", "0 9999");
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [hovered, PERIMETER, DASH_LEN]);

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
        pointerEvents: "none",
        zIndex: 10,
        opacity: hovered ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      <defs>
        <filter
          id={`gf-${color.replace("#", "")}`}
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
        >
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect
        ref={glowRef}
        x="0.5"
        y="0.5"
        width={w - 1}
        height={h - 1}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray="0 9999"
        strokeLinecap="square"
        filter={`url(#gf-${color.replace("#", "")})`}
        opacity="0.4"
      />
      <rect
        ref={dashRef}
        x="0.5"
        y="0.5"
        width={w - 1}
        height={h - 1}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray="0 9999"
        strokeLinecap="square"
      />
    </svg>
  );
}

// ─── FEATURE CARD ─────────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: Feature }) {
  const [hovered, setHovered] = useState(false);
  const [dims, setDims] = useState({ w: 300, h: 300 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      if (ref.current) {
        const r = ref.current.getBoundingClientRect();
        setDims({ w: Math.round(r.width), h: Math.round(r.height) });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        background: hovered ? "#fff" : "white",
        border: "1px solid #e5e7eb",
        margin: "-0.5px", // Collapses adjacent grid borders down to a clean 1px
        borderRadius: "0px",
        padding: "10%",
        transition: "background-color 0.3s ease, z-index 0.2s",
        cursor: "default",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        aspectRatio: "1 / 1",
        width: "100%",
        zIndex: hovered ? 5 : 1,
      }}
    >
      <SnakeBorder
        hovered={hovered}
        color={feature.color}
        w={dims.w}
        h={dims.h}
      />

      {/* Hover bg tint */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "0px",
          background: `${feature.color}05`,
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.3s ease",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          width: "100%",
        }}
      >
        {/* Top row: icon + label */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "auto",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "0px",
              background: `${feature.color}12`,
              border: `1px solid ${feature.color}22`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: feature.color,
              transition: "transform 0.3s ease",
              transform: hovered ? "scale(1.05)" : "scale(1)",
              flexShrink: 0,
            }}
          >
            {feature.icon}
          </div>

          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "10px",
              fontWeight: 600,
              color: feature.color,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              paddingTop: "4px",
            }}
          >
            {feature.label}
          </span>
        </div>

        {/* Title */}
        <h3
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(0.95rem, 1.3vw, 1.1rem)",
            color: "#111827",
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
            marginTop: "16px",
            marginBottom: "16px",
          }}
        >
          {feature.title}
        </h3>

        {/* Stat chip */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "6px",
            marginTop: "auto",
          }}
        >
          <span
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              fontSize: "11px",
              color: feature.color,
              background: `${feature.color}0e`,
              border: `1px solid ${feature.color}20`,
              padding: "2px 8px",
              borderRadius: "0px",
              whiteSpace: "nowrap",
            }}
          >
            {feature.stat}
          </span>
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "11px",
              fontWeight: 400,
              color: "#9CA3AF",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              width: "100%",
            }}
          >
            {feature.statLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN SECTION ─────────────────────────────────────────────────────────────

export default function FeaturesSection() {
  const row1 = features.slice(0, 3); // Attendance, Grading, Timetable
  const row2 = features.slice(3, 6); // Results, Finance, Role Access

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        .ej-feat *, .ej-feat *::before, .ej-feat *::after { box-sizing: border-box; }
        .ej-feat a { text-decoration: none; }

        /* Row offset grid with completely removed gaps */
        .feat-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 0px;
        }
        
        /* Row 1: cards in columns 2-4, col 1 is spacer */
        .feat-row-1 .feat-spacer { grid-column: 1; }
        .feat-row-1 .feat-card   { grid-column: span 1; }

        /* Row 2: cards in columns 1-3, col 4 is spacer */
        .feat-row-2 .feat-card   { grid-column: span 1; }
        .feat-row-2 .feat-spacer { grid-column: 4; }

        /* Collapse to simple square layout on tablets */
        @media (max-width: 900px) {
          .feat-row {
            grid-template-columns: 1fr 1fr;
          }
          .feat-row-1 .feat-spacer,
          .feat-row-2 .feat-spacer { display: none; }
        }

        /* Single col structural stack on mobile devices */
        @media (max-width: 540px) {
          .feat-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <section
        id="features"
        className="ej-feat relative w-full"
        style={{
          background: "#f8f7ff",
          padding: "clamp(64px,10vh,96px) 0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "384px",
            height: "384px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, #8B7FF515 0%, transparent 70%)",
            transform: "translate(30%,-30%)",
            filter: "blur(48px)",
            pointerEvents: "none",
            opacity: 0.4,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "320px",
            height: "320px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, #10B98115 0%, transparent 70%)",
            transform: "translate(-30%,30%)",
            filter: "blur(48px)",
            pointerEvents: "none",
            opacity: 0.3,
          }}
        />

        <div
          className="relative max-w-7xl mx-auto"
          style={{ padding: "0 clamp(24px,4vw,40px)" }}
        >
          {/* Header */}
          <div
            style={{ maxWidth: "640px", marginBottom: "clamp(40px,6vh,64px)" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{ height: "1px", width: "32px", background: "#D1D5DB" }}
              />
              <span
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#9CA3AF",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                Everything you need
              </span>
            </div>
            <h2
              style={{
                fontFamily: "'Clash Display',sans-serif",
                fontWeight: 800,
                fontSize: "clamp(2rem,4.5vw,3rem)",
                lineHeight: 1.15,
                letterSpacing: "-0.025em",
                color: "#111827",
                marginBottom: "16px",
              }}
            >
              One platform.
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg,#8B7FF5 0%,#A855F7 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Every school need.
              </span>
            </h2>
            <p
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontWeight: 400,
                fontSize: "clamp(0.95rem,1.4vw,1.05rem)",
                color: "#6B7280",
                lineHeight: 1.75,
              }}
            >
              EduJay is purpose-built for Ghanaian schools — covering every
              workflow from the first bell to the final report card.
            </p>
          </div>

          {/* ROW 1: Flush mosaic layout offset right */}
          <div className="feat-row feat-row-1">
            <div className="feat-spacer" />
            {row1.map((f) => (
              <div key={f.id} className="feat-card">
                <FeatureCard feature={f} />
              </div>
            ))}
          </div>

          {/* ROW 2: Flush mosaic layout offset left */}
          <div className="feat-row feat-row-2">
            {row2.map((f) => (
              <div key={f.id} className="feat-card">
                <FeatureCard feature={f} />
              </div>
            ))}
            <div className="feat-spacer" />
          </div>

          {/* Footer CTA */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "clamp(40px,6vh,56px)",
              paddingTop: "clamp(28px,4vh,40px)",
              borderTop: "1px solid #E5E7EB",
              gap: "16px",
            }}
          >
            <p
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: "14px",
                color: "#9CA3AF",
                fontWeight: 400,
              }}
            >
              All features available from day one. No hidden paywalls.
            </p>
            <a
              href="/features"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 24px",
                borderRadius: "12px", // Restored beautiful curved edges
                background: "linear-gradient(135deg, #5B4FE9 0%, #7C71F0 100%)",
                color: "#fff",
                fontFamily: "'DM Sans',sans-serif",
                fontSize: "14px",
                fontWeight: 600,
                boxShadow: "0 4px 20px rgba(139,127,245,0.3)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 8px 28px rgba(91,79,233,0.45)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 4px 20px rgba(139,127,245,0.3)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Explore all features
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
