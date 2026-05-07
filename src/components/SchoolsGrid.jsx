"use client";

import { useEffect, useRef, useState } from "react";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const ROW_ONE = [
  { name: "Accra Academy",      region: "Greater Accra", est: "1931" },
  { name: "Presec Legon",       region: "Greater Accra", est: "1946" },
  { name: "Achimota School",    region: "Greater Accra", est: "1924" },
];

const ROW_TWO = [
  { name: "Ridge School",       region: "Greater Accra", est: "1955" },
  { name: "Roman Ridge School", region: "Greater Accra", est: "1993" },
  { name: "Adisadel College",   region: "Central",       est: "1910" },
];

// ─── MARQUEE ROW ──────────────────────────────────────────────────────────────

function MarqueeRow({ schools, reverse = false, speed = 0.55 }) {
  const trackRef = useRef(null);
  const posRef   = useRef(0);
  const rafRef   = useRef(null);
  const items    = [...schools, ...schools, ...schools, ...schools];

  useEffect(() => {
    const dir = reverse ? -1 : 1;
    const tick = () => {
      const el = trackRef.current;
      if (el) {
        posRef.current += speed * dir;
        const half = el.scrollWidth / 2;
        if (posRef.current >= half)  posRef.current -= half;
        if (posRef.current <= -half) posRef.current += half;
        el.style.transform = `translateX(${-posRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [reverse, speed]);

  return (
    <div style={{ overflow: "hidden", width: "100%", position: "relative" }}>
      {/* fade edges */}
      <div style={{ position:"absolute", left:0, top:0, bottom:0, width:"120px", background:"linear-gradient(to right, #ffffff, transparent)", zIndex:2, pointerEvents:"none" }} />
      <div style={{ position:"absolute", right:0, top:0, bottom:0, width:"120px", background:"linear-gradient(to left,  #ffffff, transparent)", zIndex:2, pointerEvents:"none" }} />

      <div
        ref={trackRef}
        style={{
          display:   "flex",
          gap:       "12px",
          width:     "max-content",
          willChange:"transform",
          padding:   "4px 0",
        }}
      >
        {items.map((s, i) => (
          <SchoolPill key={i} school={s} />
        ))}
      </div>
    </div>
  );
}

// ─── SCHOOL PILL ──────────────────────────────────────────────────────────────

function SchoolPill({ school }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            "12px",
        padding:        "14px 22px",
        borderRadius:   "16px",
        background:     hovered ? "#fff" : "rgba(255,255,255,0.7)",
        border:         hovered ? "1px solid rgba(91,79,233,0.2)" : "1px solid rgba(0,0,0,0.06)",
        boxShadow:      hovered
          ? "0 8px 28px rgba(91,79,233,0.12), 0 1px 4px rgba(0,0,0,0.04)"
          : "0 1px 4px rgba(0,0,0,0.04)",
        transition:     "all 0.25s ease",
        cursor:         "default",
        flexShrink:     0,
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Dot */}
      <div style={{
        width:       "8px",
        height:      "8px",
        borderRadius:"50%",
        background:   hovered ? "#5B4FE9" : "#C7D2FE",
        flexShrink:  0,
        transition:  "background 0.25s",
      }} />

      {/* Name */}
      <span style={{
        fontFamily:    "'Sora', sans-serif",
        fontWeight:    600,
        fontSize:      "14px",
        color:         hovered ? "#1F2937" : "#374151",
        letterSpacing: "-0.01em",
        whiteSpace:    "nowrap",
        transition:    "color 0.25s",
      }}>
        {school.name}
      </span>

      {/* Divider */}
      <div style={{ width:"1px", height:"14px", background:"#E5E7EB", flexShrink:0 }} />

      {/* Region */}
      <span style={{
        fontFamily:  "'DM Sans', sans-serif",
        fontWeight:  400,
        fontSize:    "12px",
        color:       hovered ? "#6B7280" : "#9CA3AF",
        whiteSpace:  "nowrap",
        transition:  "color 0.25s",
      }}>
        {school.region}
      </span>

      {/* Est. badge */}
      <span style={{
        fontFamily:    "'DM Sans', sans-serif",
        fontWeight:    500,
        fontSize:      "11px",
        padding:       "2px 8px",
        borderRadius:  "6px",
        background:    hovered ? "rgba(91,79,233,0.08)" : "rgba(0,0,0,0.04)",
        color:         hovered ? "#5B4FE9" : "#9CA3AF",
        whiteSpace:    "nowrap",
        transition:    "all 0.25s",
        flexShrink:    0,
      }}>
        Est. {school.est}
      </span>
    </div>
  );
}

// ─── COUNT-UP STAT ────────────────────────────────────────────────────────────

function Stat({ value, suffix = "", label, color, delay = 0 }) {
  const [n, setN]       = useState(0);
  const [vis, setVis]   = useState(false);
  const ref             = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!vis) return;
    const t = setTimeout(() => {
      let v = 0;
      const steps = 52;
      const inc   = value / steps;
      const tick  = () => {
        v = Math.min(v + inc, value);
        setN(Math.round(v));
        if (v < value) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t);
  }, [vis, value, delay]);

  return (
    <div ref={ref} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
      <div style={{
        fontFamily:    "'Sora', sans-serif",
        fontWeight:    800,
        fontSize:      "clamp(2rem, 4vw, 2.8rem)",
        color:         color,
        lineHeight:    1,
        letterSpacing: "-0.02em",
      }}>
        {n}{suffix}
      </div>
      <div style={{
        fontFamily:    "'DM Sans', sans-serif",
        fontWeight:    400,
        fontSize:      "13px",
        color:         "#9CA3AF",
        textAlign:     "center",
        lineHeight:    1.4,
      }}>
        {label}
      </div>
    </div>
  );
}

// ─── MAIN SECTION ─────────────────────────────────────────────────────────────

export default function SchoolsSection() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        .ej-schools-section *, .ej-schools-section *::before, .ej-schools-section *::after { box-sizing: border-box; }
        .ej-schools-section a { text-decoration: none; }
      `}</style>

      <section
        className="ej-schools-section"
        style={{
          position:   "relative",
          width:      "100%",
          padding:    "clamp(64px,8vh,96px) 0",
          background: "#ffffff",
          overflow:   "hidden",
          borderTop:  "1px solid #F3F4F6",
        }}
      >
        {/* Single very subtle blue tint — won't blend with the purple #f8f7ff above */}
        <div style={{
          position:"absolute", bottom:0, right:0,
          width:"500px", height:"500px", borderRadius:"50%",
          background:"radial-gradient(circle, rgba(91,79,233,0.04) 0%, transparent 65%)",
          transform:"translate(20%, 20%)",
          pointerEvents:"none",
        }} />

        {/* ── HEADER — exactly matches FeaturesSection layout ── */}
        <div style={{ maxWidth:"1280px", margin:"0 auto", padding:"0 clamp(24px,3vw,40px)", marginBottom:"clamp(40px,6vh,60px)" }}>

          <div style={{ maxWidth:"640px" }}>
            {/* Eyebrow — matches features */}
            <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px" }}>
              <div style={{ height:"1px", width:"32px", background:"#D1D5DB", borderRadius:"999px" }} />
              <span style={{
                fontFamily:    "'DM Sans', sans-serif",
                fontSize:      "12px",
                fontWeight:    600,
                color:         "#9CA3AF",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}>
                Schools using EduJay
              </span>
            </div>

            {/* Heading — same scale as features h2 */}
            <h2 style={{
              fontFamily:    "'Sora', sans-serif",
              fontWeight:    800,
              fontSize:      "clamp(2rem, 4.5vw, 3rem)",
              lineHeight:    1.15,
              letterSpacing: "-0.025em",
              color:         "#111827",
              marginBottom:  "16px",
            }}>
              Trusted by schools<br />
              <span style={{
                background:           "linear-gradient(135deg, #5B4FE9 0%, #8B7FF5 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor:  "transparent",
                backgroundClip:       "text",
              }}>
                across Ghana.
              </span>
            </h2>

            {/* Sub — same scale as features p */}
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 400,
              fontSize:   "clamp(0.95rem, 1.4vw, 1.05rem)",
              color:      "#6B7280",
              lineHeight: 1.75,
              maxWidth:   "520px",
            }}>
              From Greater Accra to Ashanti, schools rely on EduJay to manage students, staff, fees, and results — every day.
            </p>
          </div>
        </div>

        {/* ── MARQUEE ROWS ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:"12px", marginBottom:"clamp(40px,6vh,64px)" }}>
          <MarqueeRow schools={ROW_ONE} reverse={false} speed={0.5} />
          <MarqueeRow schools={ROW_TWO} reverse={true}  speed={0.42} />
        </div>

        {/* ── STATS STRIP — matches features bottom CTA width/padding ── */}
        <div style={{ maxWidth:"1280px", margin:"0 auto", padding:"0 clamp(24px,3vw,40px)" }}>

          <div style={{
            background:   "#fff",
            borderRadius: "20px",
            border:       "1px solid #F0EFF8",
            boxShadow:    "0 1px 4px rgba(0,0,0,0.04)",
            padding:      "clamp(28px,4vh,36px) clamp(24px,4vw,48px)",
            display:      "grid",
            gridTemplateColumns: "1fr auto 1fr auto 1fr auto 1fr",
            alignItems:   "center",
            gap:          "0",
          }}>
            <Stat value={6}   suffix="+"  label="Schools onboarded"    color="#5B4FE9"  delay={0}   />
            <div style={{ width:"1px", height:"40px", background:"#E5E7EB", margin:"0 auto" }} />
            <Stat value={850} suffix="+" label="Students managed"      color="#8B7FF5"  delay={120} />
            <div style={{ width:"1px", height:"40px", background:"#E5E7EB", margin:"0 auto" }} />
            <Stat value={98}  suffix="%"  label="Attendance accuracy"   color="#10B981"  delay={240} />
            <div style={{ width:"1px", height:"40px", background:"#E5E7EB", margin:"0 auto" }} />
            <Stat value={99}  suffix="%"  label="Platform uptime"       color="#F59E0B"  delay={360} />
          </div>

          {/* ── BOTTOM CTA — exactly mirrors features section ── */}
          <div style={{
            display:       "flex",
            flexWrap:      "wrap",
            alignItems:    "center",
            justifyContent:"space-between",
            marginTop:     "clamp(32px,5vh,48px)",
            paddingTop:    "clamp(28px,4vh,40px)",
            borderTop:     "1px solid #E5E7EB",
            gap:           "16px",
          }}>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize:   "14px",
              color:      "#9CA3AF",
              fontWeight: 400,
            }}>
              Be among the first schools to transform with EduJay.
            </p>
            <a
              href="/sign-up"
              style={{
                display:        "inline-flex",
                alignItems:     "center",
                gap:            "8px",
                padding:        "12px 24px",
                borderRadius:   "12px",
                background:     "linear-gradient(135deg, #5B4FE9 0%, #7C71F0 100%)",
                color:          "#fff",
                fontFamily:     "'DM Sans', sans-serif",
                fontWeight:     600,
                fontSize:       "14px",
                boxShadow:      "0 4px 20px rgba(139,127,245,0.3)",
                transition:     "box-shadow 0.3s, transform 0.2s",
                whiteSpace:     "nowrap",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow="0 8px 28px rgba(91,79,233,0.45)"; e.currentTarget.style.transform="translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow="0 4px 20px rgba(139,127,245,0.3)"; e.currentTarget.style.transform="translateY(0)"; }}
            >
              Get Your School Started
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>
        </div>

      </section>
    </>
  );
}