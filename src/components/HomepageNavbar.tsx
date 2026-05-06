"use client";

import { useState, useEffect } from "react";

const navLinks = [
  { label: "Features",     href: "/features" },
  { label: "How It Works", href: "/howItWorks" },
  { label: "Pricing",      href: "/pricing" },
  { label: "About",        href: "/about" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);

    // 🌟 FIX: Run the check immediately on mount to capture pre-scrolled page refreshes
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const isLight = scrolled || menuOpen;

  return (
    <>
      <style>{`
        @keyframes menuItemIn {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .nav-item-enter {
          animation: menuItemIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .nav-backdrop {
          transition: background 0.4s ease, backdrop-filter 0.4s ease,
                      box-shadow 0.4s ease, border-color 0.4s ease;
        }
        .hamburger-line {
          display: block;
          height: 2px;
          border-radius: 9999px;
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1),
                      opacity 0.2s ease,
                      background-color 0.3s ease,
                      width 0.3s ease;
        }
      `}</style>

      <nav className={`fixed top-0 left-0 right-0 z-50 nav-backdrop ${
        isLight
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100/80"
          : "bg-transparent border-b border-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-10">
          <div className="flex items-center justify-between h-16 sm:h-[72px]">

            {/* Logo */}
            <a href="/" className="flex items-center gap-2.5 group shrink-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-105"
                style={{ background: "linear-gradient(135deg, #5B4FE9 0%, #8B7FF5 100%)" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3L4 7V12C4 16.4 7.4 20.5 12 21.5C16.6 20.5 20 16.4 20 12V7L12 3Z"
                    fill="white" fillOpacity="0.9"
                  />
                  <path
                    d="M9 12L11 14L15 10"
                    stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span
                className={`text-xl font-bold tracking-tight transition-colors duration-300 ${
                  isLight ? "text-gray-900" : "text-white"
                }`}
                style={{ fontFamily: "'Sora', sans-serif" }}
              >
                Edu<span style={{ color: "#8B7FF5" }}>Jay</span>
              </span>
            </a>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isLight
                      ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-3">
              <a
                href="/sign-in"
                className={`text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 ${
                  isLight
                    ? "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Sign In
              </a>
              <a
                href="/sign-up"
                className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: "linear-gradient(135deg, #5B4FE9 0%, #7C71F0 100%)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Get Started Free
              </a>
            </div>

            {/* Mobile Hamburger */}
            <button
              className={`md:hidden p-2 rounded-lg transition-colors duration-200 ${
                isLight ? "text-gray-700 hover:bg-gray-100" : "text-white hover:bg-white/10"
              }`}
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <div className="w-5 flex flex-col gap-[5px]">
                <span
                  className="hamburger-line"
                  style={{
                    background: isLight ? "#111827" : "white",
                    transform: menuOpen ? "translateY(7px) rotate(45deg)" : "none",
                  }}
                />
                <span
                  className="hamburger-line"
                  style={{
                    background: isLight ? "#111827" : "white",
                    opacity: menuOpen ? 0 : 1,
                    transform: menuOpen ? "scaleX(0)" : "scaleX(1)",
                    width: menuOpen ? "0%" : "100%",
                  }}
                />
                <span
                  className="hamburger-line"
                  style={{
                    background: isLight ? "#111827" : "white",
                    transform: menuOpen ? "translateY(-7px) rotate(-45deg)" : "none",
                  }}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        <div
          className="md:hidden overflow-hidden"
          style={{
            maxHeight: menuOpen ? "480px" : "0",
            opacity: menuOpen ? 1 : 0,
            transition: "max-height 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease",
          }}
        >
          <div
            className="px-5 pb-6 pt-2 flex flex-col gap-1 border-t"
            style={{ borderColor: "rgba(0,0,0,0.06)" }}
          >
            {navLinks.map((link, i) => (
              <a
                key={link.label}
                href={link.href}
                className="nav-item-enter px-4 py-3 text-sm font-medium text-gray-600 hover:text-[#5B4FE9] hover:bg-[#5B4FE9]/5 rounded-lg transition-colors duration-200 flex items-center gap-2"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  animationDelay: menuOpen ? `${i * 0.055}s` : "0s",
                }}
                onClick={() => setMenuOpen(false)}
              >
                <span
                  className="w-1 h-1 rounded-full shrink-0"
                  style={{ background: "#8B7FF5" }}
                />
                {link.label}
              </a>
            ))}

            <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <a
                href="/sign-in"
                className="nav-item-enter px-4 py-3 text-sm font-medium text-gray-600 hover:text-[#5B4FE9] hover:bg-[#5B4FE9]/5 rounded-lg text-center transition-colors duration-200"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  animationDelay: menuOpen ? `${navLinks.length * 0.055}s` : "0s",
                }}
              >
                Sign In
              </a>
              <a
                href="/sign-up"
                className="nav-item-enter px-4 py-3 text-sm font-semibold text-white rounded-xl text-center shadow-md transition-all duration-300 hover:shadow-lg hover:shadow-[#5B4FE9]/20"
                style={{
                  background: "linear-gradient(135deg, #5B4FE9 0%, #7C71F0 100%)",
                  fontFamily: "'DM Sans', sans-serif",
                  animationDelay: menuOpen ? `${(navLinks.length + 1) * 0.055}s` : "0s",
                }}
              >
                Get Started Free
              </a>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}