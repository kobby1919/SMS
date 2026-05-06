"use client";

import { motion } from "framer-motion";
import { useState } from "react";

// Flexible constants to control billing calculations globally
const PER_STUDENT_TERMLY_RATE = 15; // GH₵ 15 per student per academic term
const MONTHS_PER_TERM = 4;          // Standard breakdown cycle

const plans = [
  {
    name: "Free",
    tagline: "Perfect for small local nurseries & getting started",
    baseMonthlyPrice: 0,
    baseAnnualPrice: 0,
    color: "#10B981",
    cta: "Get Started Free",
    ctaHref: "/sign-up",
    popular: false,
    isDynamic: false,
    features: [
      { text: "Up to 50 students max",          included: true },
      { text: "Up to 3 teachers",               included: true },
      { text: "Attendance tracking",            included: true },
      { text: "Basic timetable view",           included: true },
      { text: "Student & parent accounts",      included: true },
      { text: "CA & grading system",            included: false },
      { text: "Results & PDF report generation",included: false },
      { text: "Finance & fee tracking",         included: false },
      { text: "Bursar dashboard",               included: false },
      { text: "Priority support",               included: false },
      { text: "Data export (PDF/Excel)",        included: false },
    ],
  },
  {
    name: "Growth",
    tagline: "Pay exactly for what you use based on your enrollment pool",
    color: "#8B7FF5",
    cta: "Start Free Trial",
    ctaHref: "/sign-up?plan=growth",
    popular: true,
    isDynamic: true, // Triggers dynamic text and slider feedback
    features: [
      { text: "Scalable up to 500 students",    included: true },
      { text: "Unlimited teachers",             included: true },
      { text: "Attendance tracking",            included: true },
      { text: "Full timetable builder",         included: true },
      { text: "Student & parent accounts",      included: true },
      { text: "CA & grading system",            included: true },
      { text: "Results & report generation",    included: true },
      { text: "Finance & fee tracking",         included: true },
      { text: "Bursar dashboard",               included: true },
      { text: "Email support",                  included: true },
      { text: "Data export (PDF/Excel)",        included: true },
    ],
  },
  {
    name: "Enterprise",
    tagline: "For deep customization, multi-campus setups, & massive bodies",
    baseMonthlyPrice: null,
    baseAnnualPrice: null,
    color: "#F59E0B",
    cta: "Contact Us",
    ctaHref: "/contact",
    popular: false,
    isDynamic: false,
    features: [
      { text: "Unlimited students",             included: true },
      { text: "Unlimited teachers",             included: true },
      { text: "Attendance tracking",            included: true },
      { text: "Full timetable builder",         included: true },
      { text: "Student & parent accounts",      included: true },
      { text: "CA & grading system",            included: true },
      { text: "Results & report generation",    included: true },
      { text: "Finance & fee tracking",         included: true },
      { text: "Bursar dashboard",               included: true },
      { text: "Dedicated priority support",     included: true },
      { text: "Data export + custom reports",   included: true },
    ],
  },
];

export default function PricingPlans() {
  const [annual, setAnnual] = useState(false);
  const [studentCount, setStudentCount] = useState(200); // Default placeholder on initialize

  // Calculate dynamic pricing based on the interactive slider metric
  const calculateGrowthPrice = (count: number, isAnnualBilling: boolean) => {
    // Termly total based on rate per head
    const termlyTotal = count * PER_STUDENT_TERMLY_RATE;
    // Break down down into its monthly equivalent
    const baselineMonthly = Math.round(termlyTotal / MONTHS_PER_TERM);
    
    if (isAnnualBilling) {
      // Apply 20% discount on yearly conversion
      return Math.round(baselineMonthly * 0.8);
    }
    return baselineMonthly;
  };

  const dynamicGrowthPrice = calculateGrowthPrice(studentCount, annual);

  return (
    <section id="plans" className="relative w-full py-24 lg:py-32 overflow-hidden"
      style={{ background: "#f8f7ff" }}>
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-30"
        style={{ background: "radial-gradient(circle, #8B7FF515 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ background: "radial-gradient(circle, #A855F715 0%, transparent 70%)", transform: "translate(-30%, 30%)" }} />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">

        {/* Dynamic Interactive Slider for Transparency */}
        <motion.div 
          className="max-w-md mx-auto mb-12 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm text-center"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
            How many students are in your school?
          </label>
          <div className="text-3xl font-extrabold text-[#8B7FF5] mb-4" style={{ fontFamily: "'Sora', sans-serif" }}>
            {studentCount} <span className="text-sm font-medium text-gray-400">students</span>
          </div>
          <input
            type="range"
            min="50"
            max="500"
            step="10"
            value={studentCount}
            onChange={(e) => setStudentCount(Number(e.target.value))}
            className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#8B7FF5]"
          />
          <div className="flex justify-between text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wider">
            <span>50 Min</span>
            <span>500 Max</span>
          </div>
        </motion.div>

        {/* Toggle */}
        <motion.div
          className="flex flex-col items-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-3 p-1 rounded-xl mb-3"
            style={{ background: "white", border: "1px solid #e5e7eb" }}>
            <button
              onClick={() => setAnnual(false)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
              style={{
                background: !annual ? "linear-gradient(135deg, #5B4FE9, #8B7FF5)" : "transparent",
                color: !annual ? "white" : "#9ca3af",
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: !annual ? "0 2px 8px #8B7FF530" : "none",
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2"
              style={{
                background: annual ? "linear-gradient(135deg, #5B4FE9, #8B7FF5)" : "transparent",
                color: annual ? "white" : "#9ca3af",
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: annual ? "0 2px 8px #8B7FF530" : "none",
              }}
            >
              Annual
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: annual ? "rgba(255,255,255,0.25)" : "#D1FAE5", color: annual ? "white" : "#059669", fontFamily: "'DM Sans', sans-serif" }}>
                -20%
              </span>
            </button>
          </div>
          <p className="text-xs text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {annual ? "Billed annually · Save 20% vs monthly" : "Billed monthly · Switch to annual anytime"}
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              className="relative rounded-2xl overflow-hidden flex flex-col"
              style={{
                background: plan.popular ? "linear-gradient(160deg, #1e1540 0%, #0f0d2e 100%)" : "white",
                border: plan.popular ? `1px solid ${plan.color}44` : "1px solid #f1f1f3",
                boxShadow: plan.popular
                  ? `0 24px 60px ${plan.color}22, 0 0 0 1px ${plan.color}22`
                  : "0 2px 16px rgba(0,0,0,0.04)",
              }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                  style={{ background: `${plan.color}22`, color: plan.color, border: `1px solid ${plan.color}44`, fontFamily: "'DM Sans', sans-serif" }}>
                  Flexible Scaling
                </div>
              )}

              {/* Top accent */}
              <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${plan.color}, ${plan.color}66)` }} />

              <div className="p-7 flex flex-col flex-1">
                {/* Plan name */}
                <div className="mb-5">
                  <div className="text-xs font-bold uppercase tracking-widest mb-2"
                    style={{ color: plan.color, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.15em" }}>
                    {plan.name}
                  </div>
                  <p className="text-sm leading-relaxed"
                    style={{ color: plan.popular ? "rgba(255,255,255,0.5)" : "#6b7280", fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
                    {plan.tagline}
                  </p>
                </div>

                {/* Price Display */}
                <div className="mb-7 pb-7" style={{ borderBottom: `1px solid ${plan.popular ? "rgba(255,255,255,0.08)" : "#f1f1f3"}` }}>
                  {plan.baseMonthlyPrice === null ? (
                    <div>
                      <div className="text-4xl font-extrabold mb-1"
                        style={{ color: plan.popular ? "white" : "#111827", fontFamily: "'Sora', sans-serif" }}>
                        Custom
                      </div>
                      <div className="text-xs" style={{ color: plan.popular ? "rgba(255,255,255,0.4)" : "#9ca3af", fontFamily: "'DM Sans', sans-serif" }}>
                        Tailored to your campus network
                      </div>
                    </div>
                  ) : !plan.isDynamic && plan.baseMonthlyPrice === 0 ? (
                    <div>
                      <div className="text-4xl font-extrabold mb-1"
                        style={{ color: plan.popular ? "white" : "#111827", fontFamily: "'Sora', sans-serif" }}>
                        Free
                      </div>
                      <div className="text-xs" style={{ color: plan.popular ? "rgba(255,255,255,0.4)" : "#9ca3af", fontFamily: "'DM Sans', sans-serif" }}>
                        Forever — no setup token needed
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-end gap-1 mb-1">
                        <span className="text-sm font-medium" style={{ color: plan.popular ? "rgba(255,255,255,0.5)" : "#9ca3af", fontFamily: "'DM Sans', sans-serif", marginBottom: "4px" }}>GH₵</span>
                        <span className="text-4xl font-extrabold leading-none"
                          style={{ color: plan.popular ? "white" : "#111827", fontFamily: "'Sora', sans-serif" }}>
                          {dynamicGrowthPrice}
                        </span>
                        <span className="text-sm mb-1" style={{ color: plan.popular ? "rgba(255,255,255,0.4)" : "#9ca3af", fontFamily: "'DM Sans', sans-serif" }}>
                          / mo
                        </span>
                      </div>
                      <div className="text-xs font-medium" style={{ color: plan.color, fontFamily: "'DM Sans', sans-serif", marginTop: "4px" }}>
                        Equivalent to ~GH₵ 15 per term
                      </div>
                      {annual && (
                        <div className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif" }}>
                          Billed GH₵ {(dynamicGrowthPrice * 12).toLocaleString()} / year
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Features */}
                <ul className="flex flex-col gap-2.5 flex-1 mb-8">
                  {plan.features.map((f) => (
                    <li key={f.text} className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0`}
                        style={{ background: f.included ? `${plan.color}18` : "transparent", border: f.included ? `1px solid ${plan.color}30` : "1px solid #e5e7eb" }}>
                        {f.included ? (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                            <path d="M5 13L9 17L19 7" stroke={plan.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6L18 18" stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm"
                        style={{ color: f.included ? (plan.popular ? "rgba(255,255,255,0.8)" : "#374151") : (plan.popular ? "rgba(255,255,255,0.25)" : "#d1d5db"), fontFamily: "'DM Sans', sans-serif" }}>
                        {/* Dynamically adjust list label feedback based on interactive range position */}
                        {plan.isDynamic && f.text.includes("Up to 500 students") ? `Up to ${studentCount} students active` : f.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <a href={`${plan.ctaHref}${plan.isDynamic ? `&size=${studentCount}&billing=${annual ? 'annual' : 'monthly'}` : ''}`}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold text-center transition-all duration-300 hover:-translate-y-0.5 inline-block"
                  style={{
                    background: plan.popular
                      ? `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`
                      : `${plan.color}12`,
                    color: plan.popular ? "white" : plan.color,
                    border: plan.popular ? "none" : `1px solid ${plan.color}25`,
                    fontFamily: "'DM Sans', sans-serif",
                    boxShadow: plan.popular ? `0 6px 24px ${plan.color}35` : "none",
                  }}>
                  {plan.cta}
                </a>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom Note */}
        <motion.p
          className="text-center text-xs text-gray-400 mt-8"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          All prices scale using a transparent base fee of GH₵ {PER_STUDENT_TERMLY_RATE} per student per term. Need multi-campus administration?{" "}
          <a href="/contact" className="underline underline-offset-2" style={{ color: "#8B7FF5" }}>Contact system sales.</a>
        </motion.p>
      </div>
    </section>
  );
}