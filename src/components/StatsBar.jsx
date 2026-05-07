"use client";

import { useEffect, useRef, useState } from "react";

const stats = [
  {
    value: 500,
    suffix: "+",
    label: "Students Managed",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M17 21V19C17 16.8 15.2 15 13 15H5C2.8 15 1 16.8 1 19V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M23 21V19C23 17.1 21.7 15.5 20 15.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16 3.1C17.7 3.5 19 5.1 19 7C19 8.9 17.7 10.5 16 10.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    color: "#8B7FF5",
  },
  {
    value: 50,
    suffix: "+",
    label: "Schools Onboarded",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M3 9L12 2L21 9V20C21 20.6 20.6 21 20 21H15V15H9V21H4C3.4 21 3 20.6 3 20V9Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    color: "#10B981",
  },
  {
    value: 98,
    suffix: "%",
    label: "Satisfaction Rate",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M8 14S9.5 16 12 16S16 14 16 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="9" y1="9" x2="9.01" y2="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="15" y1="9" x2="15.01" y2="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
    color: "#F59E0B",
  },
  {
    value: 3,
    suffix: "",
    label: "Regions Covered",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8.1 2 5 5.1 5 9C5 14.2 12 22 12 22C12 22 19 14.2 19 9C19 5.1 15.9 2 12 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
      </svg>
    ),
    color: "#FB7185",
  },
];

/** Animates a number counting up from 0 to `target` */
function useCountUp(target, duration = 1800, start = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // ease out expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);

  return count;
}

function StatItem({ stat, started }) {
  const count = useCountUp(stat.value, 1800, started);

  return (
    <div className="flex items-center gap-4 group px-2">
      {/* Icon bubble */}
      <div
        className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
        style={{
          background: `${stat.color}14`,
          border: `1px solid ${stat.color}28`,
          color: stat.color,
        }}
      >
        {stat.icon}
      </div>

      {/* Number + label */}
      <div>
        <div
          className="text-2xl font-extrabold leading-none text-gray-900"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          {count}
          <span style={{ color: stat.color }}>{stat.suffix}</span>
        </div>
        <div
          className="text-xs text-gray-500 mt-0.5"
          style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}
        >
          {stat.label}
        </div>
      </div>
    </div>
  );
}

export default function StatsBar() {
  const ref = useRef(null);
  const [started, setStarted] = useState(false);

  // Trigger count-up when section enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="relative w-full bg-white border-b border-gray-100"
      style={{ overflow: "hidden" }}
    >
      {/* Subtle top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #8B7FF544 20%, #10B98144 50%, #F59E0B44 80%, transparent 100%)",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-0">

          {stats.map((stat, i) => (
            <div key={stat.label} className="flex items-center gap-0 w-full sm:w-auto">
              <StatItem stat={stat} started={started} />

              {/* Divider — hidden on mobile, visible between items on desktop */}
              {i < stats.length - 1 && (
                <div
                  className="hidden sm:block mx-6 lg:mx-10 h-10 w-px flex-shrink-0"
                  style={{ background: "linear-gradient(to bottom, transparent, #e5e7eb, transparent)" }}
                />
              )}
            </div>
          ))}

          {/* Right CTA nudge */}
          <div className="hidden lg:flex flex-col items-end gap-1 flex-shrink-0 pl-6"
            style={{ borderLeft: "1px solid #f3f4f6" }}>
            <p
              className="text-xs text-gray-400"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Join schools already using EduJay
            </p>
            <a
              href="/sign-up"
              className="inline-flex items-center gap-1.5 text-sm font-semibold transition-all duration-200 hover:gap-2.5"
              style={{ color: "#8B7FF5", fontFamily: "'DM Sans', sans-serif" }}
            >
              Get started free
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M13 6L19 12L13 18" stroke="#8B7FF5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Subtle bottom accent line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #e5e7eb88 30%, #e5e7eb88 70%, transparent 100%)",
        }}
      />
    </section>
  );
}