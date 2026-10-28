"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";

const inclusions = [
  { title: "School records", detail: "Student, parent, class, and staff records." },
  { title: "Attendance", detail: "Attendance recording, history, and review." },
  { title: "Teaching schedules", detail: "Class timetables and teaching assignments." },
  { title: "Assessments & reports", detail: "Assessment workflows, reviewed results, and term reports." },
  { title: "Fees & receipts", detail: "Bills, approved discounts, confirmed payments, and balances." },
  { title: "Role-based access", detail: "Access appropriate to school teams and linked parents." },
  { title: "Hosting & maintenance", detail: "Platform hosting, maintenance, and standard updates." },
  { title: "Agreed support", detail: "Support scope and onboarding arrangements set out in writing." },
];

export default function PricingPlans() {
  return (
    <section id="plans" className="relative w-full py-24 lg:py-32 scroll-mt-20" style={{ background: "#f8f7ff" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[#6654bd] mb-5" style={{ fontFamily: "var(--font-body)" }}>One annual school package</p>
            <h2 className="text-3xl min-[360px]:text-4xl xl:text-5xl font-extrabold text-gray-900 leading-tight mb-5" style={{ fontFamily: "var(--font-heading)" }}>Quoted for<br /><span className="text-[#7960d9]">your school.</span></h2>
            <p className="text-base text-gray-600 leading-relaxed mb-6" style={{ fontFamily: "var(--font-body)" }}>Tell us about your school, the setup you need, and any existing records. MiqraTech Consult will provide an annual Edujay package quotation with the agreed scope before onboarding begins.</p>
            <dl className="border-y border-[#ded9ee] py-5 space-y-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><dt className="text-gray-500">Billing basis</dt><dd className="font-semibold text-gray-800">Annual school package</dd></div>
              <div className="flex flex-wrap justify-between gap-2"><dt className="text-gray-500">Package payment to</dt><dd className="font-semibold text-gray-800">MiqraTech Consult</dd></div>
              <div className="flex flex-wrap justify-between gap-2"><dt className="text-gray-500">Price and scope</dt><dd className="font-semibold text-gray-800">Agreed in writing</dd></div>
            </dl>
            <a href="/request-access" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-white text-sm font-semibold mt-7 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6654bd]" style={{ background: "linear-gradient(135deg, #5B4FE9, #8B7FF5)", fontFamily: "var(--font-body)" }}>Request a School Quote <ArrowRight size={16} aria-hidden="true" /></a>
            <p className="mt-4 text-xs text-gray-500 leading-relaxed">Requesting a quote does not take a payment or activate your school.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }} className="min-w-0">
            <h3 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: "var(--font-heading)" }}>What the standard package covers</h3>
            <ul className="divide-y divide-[#ded9ee] border-y border-[#ded9ee]">
              {inclusions.map(item => (
                <li key={item.title} className="flex gap-3 py-4">
                  <Check size={18} className="text-[#078568] flex-shrink-0 mt-1" aria-hidden="true" />
                  <div className="min-w-0"><h4 className="text-sm font-bold text-gray-800" style={{ fontFamily: "var(--font-heading)" }}>{item.title}</h4><p className="mt-1 text-sm text-gray-600 leading-relaxed">{item.detail}</p></div>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-gray-500 leading-relaxed">Included platform features still require the appropriate setup and permissions. Online collections and external delivery channels need separate configuration and verification.</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
