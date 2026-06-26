"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const faqs = [
  {
    q: "How long does it take to fully set up Edujay for my school?",
    a: "Most schools are fully set up within an hour. School profile, classes, subjects, and your first batch of teachers and students can all be added in a single session. You don't need to complete everything before you start using it — you can add people and configure modules as you go.",
  },
  {
    q: "Do I need an IT person or technical knowledge to get started?",
    a: "Not at all. Edujay is designed for school administrators, teachers, and bursars — not developers. If you can use a smartphone or a basic computer, you can set up and run Edujay. There's no installation, no servers to manage, and no technical configuration required.",
  },
  {
    q: "Can I import existing student and teacher data?",
    a: "Yes. If you have your student and staff data in a spreadsheet, you can import it in bulk rather than entering each person manually. For schools with large enrolments, this significantly speeds up the onboarding process.",
  },
  {
    q: "What happens to my data at the end of the academic year?",
    a: "All your data is preserved. When a new academic year begins, you simply create a new year configuration and Edujay carries over your school structure, staff, and students. Historical results, attendance records, and financial data remain archived and accessible at any time.",
  },
  {
    q: "Can multiple teachers and admins use Edujay at the same time?",
    a: "Yes — Edujay is fully multi-user. Every teacher, admin, student, and parent has their own account and can be logged in simultaneously. A teacher marking attendance in Class 4B doesn't affect anything a teacher in JHS 1 is doing at the same time.",
  },
  {
    q: "What devices does Edujay work on?",
    a: "Edujay runs entirely in the browser — no app download needed. It works on any device with a modern browser: phones, tablets, laptops, and desktops. Teachers commonly mark attendance on their phones while admins use laptops for reporting.",
  },
  {
    q: "Is my school's data secure and private?",
    a: "Yes. Every school on Edujay operates in complete isolation — no school can ever see another school's data. Authentication is handled by Clerk, an enterprise-grade security platform. All data is encrypted in transit and at rest.",
  },
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
    <section id="faq" className="relative w-full py-24 lg:py-32 overflow-hidden" style={{ background: "#f0fdf8" }}>
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
            Everything you need to know before getting started.
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
          <a href="/contact"
            className="inline-flex items-center gap-2 text-sm font-semibold transition-all duration-200 hover:gap-3"
            style={{ color: "#8B7FF5", fontFamily: "'DM Sans', sans-serif" }}>
            Talk to the team
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
}