"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const faqs = [
  {
    "q": "How do we request school access?",
    "a": "Submit the school access form with an authorised contact and a short description of your needs. We review the request, discuss the package and onboarding scope, and prepare a first-administrator invitation after approval. Submitting a request does not immediately activate a school."
  },
  {
    "q": "How long does onboarding take?",
    "a": "Timing depends on your school's size, record quality, setup route, and agreed scope. We discuss the work with your representative before beginning. Existing records need validation, reconciliation, and school approval; we do not promise a fixed same-day completion time."
  },
  {
    "q": "Can we start fresh or bring existing records?",
    "a": "Yes. Start Fresh uses the normal setup and record-entry workflows. If you bring existing records, we agree source files and scope first, then use the migration workspace to upload, validate, review, and reconcile them before approval. Not every spreadsheet or historical dataset can be imported without preparation."
  },
  {
    "q": "Who from our school needs to be involved?",
    "a": "Choose an authorised representative and a school administrator to coordinate setup. Involve the people responsible for student records, academic structure, and finance where those records are included. Staff and parents receive access according to their responsibilities and the agreed onboarding sequence."
  },
  {
    "q": "How are opening fee balances checked?",
    "a": "Where opening fee records are included, compare student bills, approved discounts, confirmed opening payments or credits, and outstanding balances against the agreed source records and cutoff. Resolve differences and obtain the school's approval before completing migration; an uploaded total alone is not reconciliation."
  },
  {
    "q": "Who receives an account, and what can they access?",
    "a": "Invited administrators, teachers, bursars, and parents sign in with their own accounts. Access depends on school, role, and relevant records. Parents access their linked children's information, and finance tasks require the appropriate permissions. Creating a student record does not automatically create a login account."
  },
  {
    "q": "Do online payments work immediately?",
    "a": "No. Online school-fee collections require the school's own activated, verified payment-provider account and school-specific configuration, followed by verification before activation. External notification channels also need separate setup. Completing school onboarding does not activate these services automatically."
  },
  {
    "q": "What devices and internet access do we need?",
    "a": "Edujay is accessed through a supported web browser with an internet connection. Review the phones, tablets, and computers your team plans to use during onboarding; a larger screen is preferable for importing records and detailed review. We do not promise offline operation or identical behaviour on every device."
  }
];

function FAQItem({ item, index }: { item: typeof faqs[0]; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      className="rounded-2xl overflow-hidden"
      style={{ background: open ? "#f8f7ff" : "white", border: open ? "1px solid #8B7FF522" : "1px solid #f1f1f3" }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`onboarding-faq-${index}`}
        className="w-full flex items-start justify-between gap-4 px-6 py-5 text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-start gap-4">
          <span className="text-xs font-bold mt-0.5 flex-shrink-0"
            style={{ color: "#8B7FF5", fontFamily: "'DM Sans', sans-serif" }}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-sm font-semibold text-gray-900"
            style={{ fontFamily: "'Sora', sans-serif" }}>
            {item.q}
          </span>
        </div>
        <motion.div
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
          style={{ background: open ? "#8B7FF514" : "#f3f4f6" }}
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke={open ? "#8B7FF5" : "#9ca3af"} strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`onboarding-faq-${index}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-5 text-sm text-gray-500 leading-relaxed pl-14"
              style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function HIWFAQ() {
  return (
    <section id="faq" className="relative w-full py-24 lg:py-32 overflow-hidden scroll-mt-20" style={{ background: "#f0fdf8" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, #10B98118 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.5 }} />

      <div className="relative max-w-3xl mx-auto px-6 lg:px-10">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-8 bg-gray-300 rounded-full" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400"
              style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.18em" }}>
              Common questions
            </span>
            <div className="h-px w-8 bg-gray-300 rounded-full" />
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4"
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Questions
            <span style={{ background: "linear-gradient(135deg, #8B7FF5 0%, #10B981 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}> answered.</span>
          </h2>
          <p className="text-base text-gray-500 leading-relaxed"
            style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
            Practical answers about school access, records, and getting ready.
          </p>
        </motion.div>

        <div className="flex flex-col gap-3">
          {faqs.map((item, i) => (
            <FAQItem key={i} item={item} index={i} />
          ))}
        </div>

        {/* Still have questions */}
        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="text-sm text-gray-400 mb-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Still have questions?
          </p>
          <a href="/request-access"
            className="inline-flex items-center gap-2 text-sm font-semibold transition-all duration-200 hover:gap-3"
            style={{ color: "#8B7FF5", fontFamily: "'DM Sans', sans-serif" }}>
            Discuss your school&apos;s needs
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
