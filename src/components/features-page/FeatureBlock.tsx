"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Benefit = {
  text: string;
};

type FeatureBlockProps = {
  id: string;
  label: string;
  color: string;
  heading: string;
  headingAccent: string;
  description: string;
  benefits: Benefit[];
  visual: ReactNode;
  flip?: boolean;
  bg?: string;
};

export default function FeatureBlock({
  id,
  label,
  color,
  heading,
  headingAccent,
  description,
  benefits,
  visual,
  flip = false,
  bg = "white",
}: FeatureBlockProps) {
  return (
    <section
      id={id}
      className="relative w-full py-24 lg:py-32 overflow-hidden"
      style={{ background: bg }}
    >
      {/* Subtle bg glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at ${flip ? "80%" : "20%"} 50%, ${color}09 0%, transparent 60%)` }} />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        <div className={`flex flex-col ${flip ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-16 lg:gap-20`}>

          {/* Text side */}
          <motion.div
            className="flex-1 max-w-lg"
            initial={{ opacity: 0, x: flip ? 30 : -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Label */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
              style={{ background: `${color}12`, border: `1px solid ${color}28` }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
              <span className="text-xs font-semibold uppercase tracking-widest"
                style={{ color, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.14em" }}>
                {label}
              </span>
            </div>

            {/* Heading */}
            <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-3"
              style={{ fontFamily: "'Clash Display', sans-serif" }}>
              {heading}
              <br />
              <span style={{ color }}>{headingAccent}</span>
            </h2>

            {/* Description */}
            <p className="text-base text-gray-500 leading-relaxed mb-8"
              style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
              {description}
            </p>

            {/* Benefits */}
            <ul className="flex flex-col gap-3 mb-8">
              {benefits.map((b, i) => (
                <motion.li
                  key={i}
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13L9 17L19 7" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-600 leading-relaxed"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {b.text}
                  </span>
                </motion.li>
              ))}
            </ul>

            {/* Learn more link */}
            <a href="/sign-up"
              className="inline-flex items-center gap-2 text-sm font-semibold transition-all duration-200 hover:gap-3"
              style={{ color, fontFamily: "'DM Sans', sans-serif" }}>
              Get started with this feature
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </motion.div>

          {/* Visual side */}
          <motion.div
            className="flex-1 w-full"
            initial={{ opacity: 0, x: flip ? -30 : 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            {visual}
          </motion.div>
        </div>
      </div>
    </section>
  );
}