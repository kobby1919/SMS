"use client";

import { motion } from "framer-motion";
import EdujayBrandLogo from "@/src/components/EdujayBrandLogo";

const footerLinks = {
  Product: [
    { label: "Features",    href: "/features" },
    { label: "How It Works",href: "/howItWorks" },
    { label: "Pricing",     href: "/pricing" },
  ],
  Company: [
    { label: "About",       href: "/about" },
    { label: "School Enquiries", href: "/request-access" },
  ],
};

const quotes = [
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "The roots of education are bitter, but the fruit is sweet.", author: "Aristotle" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
];

export default function Footer() {
  const quote = quotes[0];

  return (
    <footer className="relative w-full overflow-hidden" style={{ background: "#0a0916" }}>

      {/* Top glow */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, #8B7FF533, #A855F733, transparent)" }} />

      {/* Ambient light */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(91,79,233,0.08) 0%, transparent 60%)" }} />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">

        {/* ── Quote strip ── */}
        <motion.div
          className="py-14 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex flex-col items-center text-center gap-3">
            {/* Large decorative quote mark */}
            <div className="text-6xl leading-none select-none"
              style={{ color: "#8B7FF522", fontFamily: "Georgia, serif", lineHeight: 0.7 }}>
              &quot;
            </div>
            <p className="text-xl lg:text-2xl font-medium max-w-2xl leading-relaxed"
              style={{ color: "rgba(255,255,255,0.75)", fontFamily: "'Clash Display', sans-serif", fontWeight: 500 }}>
              {quote.text}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-px w-6 rounded-full" style={{ background: "#8B7FF555" }} />
              <span className="text-sm" style={{ color: "#8B7FF5", fontFamily: "'Clash Display', sans-serif", fontWeight: 500 }}>
                {quote.author}
              </span>
              <div className="h-px w-6 rounded-full" style={{ background: "#8B7FF555" }} />
            </div>
          </div>
        </motion.div>

        {/* ── Main footer grid ── */}
        <motion.div
          className="py-14 grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-8 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Brand col — 2 cols wide */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Logo */}
            <EdujayBrandLogo size="md" wordmarkClassName="text-white" />
            {/* Tagline */}
            <p className="text-sm leading-relaxed max-w-xs"
              style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
              The all-in-one school management platform built for Ghanaian schools.
              From Nursery to JHS — we&apos;ve got you covered.
            </p>

            <a href="mailto:miqratechc@gmail.com" className="text-sm text-white/60 hover:text-white transition-colors break-all">miqratechc@gmail.com</a>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group} className="flex flex-col gap-4">
              <h4 className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.25)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.18em" }}>
                {group}
              </h4>
              <ul className="flex flex-col gap-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href}
                      className="text-sm transition-colors duration-200"
                      style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'DM Sans', sans-serif" }}
                      onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = "#8B7FF5"}
                      onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.45)"}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>

        {/* ── Bottom bar ── */}
        <motion.div
          className="py-6 flex flex-col sm:flex-row items-center justify-between gap-3"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "'DM Sans', sans-serif" }}>
            © {new Date().getFullYear()} Edujay · MiqraTech Consult.
          </p>

        </motion.div>
      </div>
    </footer>
  );
}
