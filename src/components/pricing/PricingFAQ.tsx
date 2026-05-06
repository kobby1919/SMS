"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const faqs = [
  {
    q: "Can I upgrade or downgrade my plan at any time?",
    a: "Yes. You can upgrade to Growth at any time and your school data carries over immediately. If you downgrade to Free, your data is preserved but features above the Free tier become read-only until you upgrade again.",
  },
  {
    q: "What happens when I exceed the Free plan student limit?",
    a: "When you reach 50 students on the Free plan, you'll be prompted to upgrade to Growth to add more. Existing students and their data remain fully accessible — nothing is deleted.",
  },
  {
    q: "Is there a trial period for the Growth plan?",
    a: "Yes — Growth comes with a 14-day free trial. No credit card required to start. At the end of the trial you can subscribe or continue on the Free plan.",
  },
  {
    q: "Do you offer discounts for government or public schools?",
    a: "Yes. We offer special pricing for government-funded public schools in Ghana. Contact us with your school's details and we'll work out a plan that fits your budget.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept Mobile Money (MTN MoMo, Vodafone Cash, AirtelTigo Money), bank transfers, and major credit/debit cards. All payments are processed securely.",
  },
  {
    q: "What does the Enterprise plan include that Growth doesn't?",
    a: "Enterprise is designed for large schools (500+ students) and school networks managing multiple campuses. It includes unlimited students, dedicated priority support, custom onboarding, advanced reporting, and custom pricing based on your scale.",
  },
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
        onClick={() => setOpen(!open)}>
        <div className="flex items-start gap-4">
          <span className="text-xs font-bold mt-0.5 flex-shrink-0"
            style={{ color: "#8B7FF5", fontFamily: "'DM Sans', sans-serif" }}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-sm font-semibold text-gray-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
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

export default function PricingFAQ() {
  return (
    <section className="relative w-full py-24 lg:py-28 overflow-hidden" style={{ background: "#f0fdf8" }}>
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
              style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.18em" }}>
              Pricing questions
            </span>
            <div className="h-px w-8 bg-gray-300 rounded-full" />
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight mb-3"
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Pricing, clarified.
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed"
            style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
            Still unsure? These are the questions schools ask most before signing up.
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
          <p className="text-sm text-gray-400 mb-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Have a question that's not here?
          </p>
          <a href="/contact"
            className="inline-flex items-center gap-2 text-sm font-semibold transition-all duration-200 hover:gap-3"
            style={{ color: "#8B7FF5", fontFamily: "'DM Sans', sans-serif" }}>
            Contact the team
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
