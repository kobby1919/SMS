"use client";

import React, { useEffect, useRef } from "react";

export default function EdujayBackground({
  children,
}: {
  children?: React.ReactNode;
}) {
  const m1Ref  = useRef<HTMLDivElement>(null);
  const m2Ref  = useRef<HTMLDivElement>(null);
  const m3Ref  = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = (ts: number) => {
      const t = ts * 0.00018;

      if (m1Ref.current) {
        const x = 12 + Math.sin(t * 0.7) * 8;
        const y = -8 + Math.cos(t * 0.5) * 10;
        m1Ref.current.style.transform = `translate(${x}%, ${y}%)`;
      }
      if (m2Ref.current) {
        const x = 55 + Math.cos(t * 0.6) * 10;
        const y = 50 + Math.sin(t * 0.4) * 12;
        m2Ref.current.style.transform = `translate(${x}%, ${y}%)`;
      }
      if (m3Ref.current) {
        const x = 35 + Math.sin(t * 0.35 + 1.2) * 14;
        const y = 20 + Math.cos(t * 0.45 + 0.8) * 16;
        m3Ref.current.style.transform = `translate(${x}%, ${y}%)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      style={{
        position:   "relative",
        width:      "100%",
        background: "#080B18",
        // isolation creates a new stacking context so z-index works correctly
        isolation:  "isolate",
      }}
    >
      {/* Aurora mass 1 — purple, top-left */}
      <div
        ref={m1Ref}
        aria-hidden="true"
        style={{
          position:     "absolute",
          top:          "-20%",
          left:         "-20%",
          width:        "80vw",
          height:       "80vw",
          borderRadius: "50%",
          background:   "radial-gradient(circle at 40% 40%, rgba(91,79,233,0.32) 0%, rgba(91,79,233,0.1) 40%, transparent 68%)",
          filter:       "blur(80px)",
          willChange:   "transform",
          zIndex:       0,
          pointerEvents:"none",
        }}
      />

      {/* Aurora mass 2 — sea blue, bottom-right */}
      <div
        ref={m2Ref}
        aria-hidden="true"
        style={{
          position:     "absolute",
          top:          "0",
          left:         "0",
          width:        "65vw",
          height:       "65vw",
          borderRadius: "50%",
          background:   "radial-gradient(circle at 55% 55%, rgba(26,111,168,0.26) 0%, rgba(26,111,168,0.07) 45%, transparent 68%)",
          filter:       "blur(90px)",
          willChange:   "transform",
          zIndex:       0,
          pointerEvents:"none",
        }}
      />

      {/* Aurora mass 3 — indigo, centre drift */}
      <div
        ref={m3Ref}
        aria-hidden="true"
        style={{
          position:     "absolute",
          top:          "0",
          left:         "0",
          width:        "50vw",
          height:       "50vw",
          borderRadius: "50%",
          background:   "radial-gradient(circle at 50% 50%, rgba(139,127,245,0.18) 0%, rgba(139,127,245,0.05) 50%, transparent 70%)",
          filter:       "blur(70px)",
          willChange:   "transform",
          zIndex:       0,
          pointerEvents:"none",
        }}
      />

      {/* Vignette — darkens edges so content stays readable */}
      <div
        aria-hidden="true"
        style={{
          position:     "absolute",
          inset:        0,
          zIndex:       1,
          background:   "radial-gradient(ellipse 90% 90% at 50% 50%, transparent 40%, rgba(4,6,16,0.6) 75%, rgba(4,6,16,0.92) 100%)",
          pointerEvents:"none",
        }}
      />

      {/* Chalk texture — three diagonal passes at near-zero opacity */}
      <div
        aria-hidden="true"
        style={{
          position:        "absolute",
          inset:           0,
          zIndex:          1,
          opacity:         0.022,
          backgroundImage: [
            "repeating-linear-gradient(47deg,  rgba(255,255,255,0.9) 0px, rgba(255,255,255,0.9) 1px, transparent 1px, transparent 38px)",
            "repeating-linear-gradient(133deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 62px)",
            "repeating-linear-gradient(47deg,  rgba(255,255,255,0.4) 0px, rgba(255,255,255,0.4) 1px, transparent 1px, transparent 94px)",
          ].join(","),
          pointerEvents:   "none",
        }}
      />

      {/* Content — z-index 2 sits above all background layers */}
      <div style={{ position: "relative", zIndex: 2 }}>
        {children}
      </div>
    </div>
  );
}