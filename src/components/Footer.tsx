"use client";

import { motion } from "framer-motion";

const footerLinks = {
  Product: [
    { label: "Features",    href: "/features" },
    { label: "How It Works",href: "/howItWorks" },
    { label: "Pricing",     href: "/pricing" },
    { label: "Changelog",   href: "/changelog" },
  ],
  Company: [
    { label: "About",       href: "/about" },
    { label: "Contact",     href: "/contact" },
    { label: "Blog",        href: "/blog" },
    { label: "Careers",     href: "/careers" },
  ],
  Legal: [
    { label: "Privacy Policy",   href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy",    href: "/cookies" },
  ],
};

const quotes = [
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "The roots of education are bitter, but the fruit is sweet.", author: "Aristotle" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
];

const socials = [
  {
    label: "Twitter",
    href: "#",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "#",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "#",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
];

export default function Footer() {
  const quote = quotes[0]; // Aristotle — timeless and clean

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
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #5B4FE9 0%, #8B7FF5 100%)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3L4 7V12C4 16.4 7.4 20.5 12 21.5C16.6 20.5 20 16.4 20 12V7L12 3Z"
                    fill="white" fillOpacity="0.9" />
                  <path d="M9 12L11 14L15 10" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight text-white"
                style={{ fontFamily: "'Sora', sans-serif" }}>
                Edu<span style={{ color: "#8B7FF5" }}>Jay</span>
              </span>
            </div>

            {/* Tagline */}
            <p className="text-sm leading-relaxed max-w-xs"
              style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
              The all-in-one school management platform built for Ghanaian schools.
              From Nursery to JHS — we&apos;ve got you covered.
            </p>

            {/* Contact */}
            <div className="flex flex-col gap-2">
              {[
                { icon: "✉", text: "hello@edujay.com.gh" },
                { icon: "📍", text: "Accra, Ghana" },
              ].map((c) => (
                <div key={c.text} className="flex items-center gap-2">
                  <span className="text-xs">{c.icon}</span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'DM Sans', sans-serif" }}>
                    {c.text}
                  </span>
                </div>
              ))}
            </div>

            {/* Socials */}
            <div className="flex items-center gap-2">
              {socials.map((s) => (
                <a key={s.label} href={s.href} aria-label={s.label}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.45)",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(139,127,245,0.15)";
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(139,127,245,0.3)";
                    (e.currentTarget as HTMLAnchorElement).style.color = "#8B7FF5";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)";
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.08)";
                    (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.45)";
                  }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
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
            © {new Date().getFullYear()} EduJay. Built with ❤️ in Ghana.
          </p>

          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#10B981" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "'DM Sans', sans-serif" }}>
              All systems operational
            </span>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
