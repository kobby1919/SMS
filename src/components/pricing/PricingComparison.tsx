"use client";

import { motion } from "framer-motion";

const scope = [
  { title: "Annual package", text: "Standard platform features, hosting, maintenance, updates, and defined support are covered by the agreed school package. There are no separate standard-feature upgrade tiers." },
  { title: "Onboarding & migration", text: "The quotation states what setup and migration work is included. Any additional work outside that scope is quoted upfront and agreed before it begins." },
  { title: "Optional & provider costs", text: "Optional messaging usage, payment-provider processing charges, and separately agreed custom work may cost extra. These are disclosed separately; unconnected services are not automatically included or active." },
];
const steps = [
  { title: "School requirements", text: "Share your school size, workflows, and existing-record needs." },
  { title: "Scope review", text: "Discuss setup, migration, support, and optional services." },
  { title: "Written quotation", text: "Receive the annual price, inclusions, and any additional costs." },
  { title: "School acceptance", text: "Agree the quotation and arrangements before onboarding begins." },
];

export default function PricingComparison() {
  return (
    <section id="package-details" className="relative w-full py-24 lg:py-28 scroll-mt-20 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <header className="max-w-2xl mb-10">
            <p className="text-xs font-semibold uppercase text-[#6654bd] mb-4">Know the scope before you begin</p>
            <h2 className="text-3xl min-[360px]:text-4xl font-extrabold leading-tight text-gray-900 mb-4" style={{ fontFamily: "var(--font-heading)" }}>Clear costs.<br /><span className="text-[#7960d9]">No surprise extras.</span></h2>
            <p className="text-base text-gray-600 leading-relaxed">Your quotation should distinguish the annual package from any separately agreed work or external service charges.</p>
          </header>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 border-y border-gray-200 py-8">
            {scope.map(item => (<div key={item.title} className="min-w-0"><h3 className="text-lg font-bold text-gray-900 mb-3" style={{ fontFamily: "var(--font-heading)" }}>{item.title}</h3><p className="text-sm text-gray-600 leading-relaxed">{item.text}</p></div>))}
          </div>
          <div className="py-10 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: "var(--font-heading)" }}>Two separate payment flows</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="min-w-0"><h4 className="text-sm font-bold text-[#6654bd] mb-2">School to MiqraTech Consult</h4><p className="text-sm text-gray-600 leading-relaxed">The school pays MiqraTech Consult for its annual Edujay package, according to the agreed quotation and invoice.</p></div>
              <div className="min-w-0"><h4 className="text-sm font-bold text-[#087f68] mb-2">Parent to school</h4><p className="text-sm text-gray-600 leading-relaxed">When online school-fee collections are enabled, parents pay through the school&apos;s own verified payment-provider account. These payments are not Edujay subscription revenue.</p></div>
            </div>
          </div>
          <div className="pt-10">
            <h3 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: "var(--font-heading)" }}>How your quotation is agreed</h3>
            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7">
              {steps.map((step, index) => (<li key={step.title} className="border-t-2 border-[#ddd7f2] pt-4 min-w-0"><span className="text-xs font-bold text-[#7960d9]" aria-hidden="true">0{index + 1}</span><h4 className="text-sm font-bold text-gray-900 mt-3 mb-2">{step.title}</h4><p className="text-sm text-gray-600 leading-relaxed">{step.text}</p></li>))}
            </ol>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
