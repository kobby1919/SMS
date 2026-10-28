"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const faqs = [
  {
    "q": "How much does Edujay cost?",
    "a": "The school receives an annual package quotation from MiqraTech Consult after its requirements and onboarding scope are reviewed. No fixed public rate is currently published. Request a school quote to discuss your needs before committing."
  },
  {
    "q": "What does the annual package include?",
    "a": "The standard package covers school records, attendance, teaching schedules, assessments and reports, finance workflows, role-based access, hosting, maintenance, standard updates, and defined support. The quotation confirms the scope. Features require appropriate setup and permissions; external services do not activate automatically."
  },
  {
    "q": "Are setup and migration included?",
    "a": "The quotation states which onboarding and migration work is included. Existing records need an agreed scope and review. Work outside that scope is separately quoted and agreed before it begins, rather than added as an unexpected charge."
  },
  {
    "q": "What may cost separately?",
    "a": "Optional messaging usage, payment-provider processing charges, and additional custom work outside the agreed package may cost extra. Availability, responsibility for charges, and any additional costs must be made clear before the service or work is agreed."
  },
  {
    "q": "Do parent fee payments go to MiqraTech Consult?",
    "a": "No. When online school-fee collections are enabled, payments use the school's own activated, verified payment-provider account. The school pays MiqraTech Consult separately for the annual Edujay package. Provider verification and processing requirements still apply."
  },
  {
    "q": "How does the school pay for Edujay?",
    "a": "Payment instructions and billing dates are provided with the agreed quotation and invoice. Requesting a quote does not take a payment. Do not treat the school-fee checkout as an Edujay subscription checkout."
  },
  {
    "q": "How do renewal and cancellation work?",
    "a": "The package is annual. Payment dates, renewal arrangements, cancellation terms, any refund arrangements, and support scope are agreed in writing before acceptance. Discuss these terms with MiqraTech Consult when reviewing your quotation."
  },
  {
    "q": "Is there a free plan or trial?",
    "a": "There is no published free package or standard free-trial offer on this page. Any pilot or evaluation arrangement must be agreed explicitly with MiqraTech Consult, including its scope, duration, and any charges."
  }
];

function FAQItem({ item, index }: { item: typeof faqs[0]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      className="rounded-2xl overflow-hidden"
      style={{ background: open ? "#f8f7ff" : "white", border: open ? "1px solid #8B7FF522" : "1px solid #f1f1f3" }}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
    >
      <button className="w-full flex items-start justify-between gap-4 px-6 py-5 text-left"
        type="button"
        aria-expanded={open}
        aria-controls={`pricing-faq-${index}`}
        onClick={() => setOpen(!open)}>
        <div className="flex items-start gap-4">
          <span className="text-xs font-bold mt-0.5 flex-shrink-0"
            style={{ color: "#8B7FF5", fontFamily: "var(--font-body)" }}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-sm font-semibold text-gray-900" style={{ fontFamily: "var(--font-heading)" }}>
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
            id={`pricing-faq-${index}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-5 text-sm text-gray-500 leading-relaxed pl-14"
              style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}>
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function PricingFAQ() {
  return (
    <section id="pricing-faq" className="relative w-full py-24 lg:py-28 overflow-hidden scroll-mt-20" style={{ background: "#f0fdf8" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, #10B98118 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.5 }} />

      <div className="relative max-w-3xl mx-auto px-6 lg:px-10">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-8 bg-gray-300 rounded-full" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400"
              style={{ fontFamily: "var(--font-body)", letterSpacing: "0.18em" }}>
              Pricing questions
            </span>
            <div className="h-px w-8 bg-gray-300 rounded-full" />
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight mb-3"
            style={{ fontFamily: "var(--font-heading)" }}>
            Pricing, clarified.
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed"
            style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}>
            Practical answers about the annual package, quotations, and separate costs.
          </p>
        </motion.div>

        <div className="flex flex-col gap-3">
          {faqs.map((item, i) => (
            <FAQItem key={i} item={item} index={i} />
          ))}
        </div>

        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="text-sm text-gray-400 mb-3" style={{ fontFamily: "var(--font-body)" }}>
            Have a question that&apos;s not here?
          </p>
          <a href="/request-access"
            className="inline-flex items-center gap-2 text-sm font-semibold transition-all duration-200 hover:gap-3"
            style={{ color: "#8B7FF5", fontFamily: "var(--font-body)" }}>
            Discuss Your School Quote
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
