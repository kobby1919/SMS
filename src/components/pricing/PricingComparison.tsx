"use client";

import { Fragment } from "react"; // 1. Imported Fragment to hold the key safely
import { motion } from "framer-motion";

const rows = [
  { category: "School Setup",   feature: "School profile & academic year",  free: true,   growth: true,  enterprise: true  },
  { category: "School Setup",   feature: "Classes & sections",              free: true,   growth: true,  enterprise: true  },
  { category: "School Setup",   feature: "Subjects & curriculum",           free: true,   growth: true,  enterprise: true  },
  { category: "People",         feature: "Student accounts",                free: "50",   growth: "500", enterprise: "∞"   },
  { category: "People",         feature: "Teacher accounts",                free: "3",    growth: "∞",   enterprise: "∞"   },
  { category: "People",         feature: "Parent accounts",                 free: true,   growth: true,  enterprise: true  },
  { category: "Attendance",     feature: "Daily attendance marking",        free: true,   growth: true,  enterprise: true  },
  { category: "Attendance",     feature: "Consecutive absence alerts",      free: false,  growth: true,  enterprise: true  },
  { category: "Attendance",     feature: "Attendance history & reports",    free: false,  growth: true,  enterprise: true  },
  { category: "Grading",        feature: "CA component scoring",            free: false,  growth: true,  enterprise: true  },
  { category: "Grading",        feature: "Configurable CA/exam split",      free: false,  growth: true,  enterprise: true  },
  { category: "Grading",        feature: "Auto grade computation",          free: false,  growth: true,  enterprise: true  },
  { category: "Timetable",      feature: "Basic timetable view",            free: true,   growth: true,  enterprise: true  },
  { category: "Timetable",      feature: "Conflict detection",              free: false,  growth: true,  enterprise: true  },
  { category: "Results",        feature: "Term result reports",             free: false,  growth: true,  enterprise: true  },
  { category: "Results",        feature: "PDF export",                      free: false,  growth: true,  enterprise: true  },
  { category: "Finance",        feature: "Fee tracking & ledger",           free: false,  growth: true,  enterprise: true  },
  { category: "Finance",        feature: "Bursar dashboard",                free: false,  growth: true,  enterprise: true  },
  { category: "Finance",        feature: "Excel & PDF export",              free: false,  growth: true,  enterprise: true  },
  { category: "Support",        feature: "Community support",               free: true,   growth: true,  enterprise: true  },
  { category: "Support",        feature: "Email support",                   free: false,  growth: true,  enterprise: true  },
  { category: "Support",        feature: "Priority & dedicated support",    free: false,  growth: false, enterprise: true  },
  { category: "Support",        feature: "Custom onboarding",               free: false,  growth: false, enterprise: true  },
];

const categories = [...new Set(rows.map(r => r.category))];
const planColors = { free: "#10B981", growth: "#8B7FF5", enterprise: "#F59E0B" };

function Cell({ value, color }: { value: boolean | string; color: string }) {
  if (typeof value === "string") {
    return (
      <td className="py-3 px-4 text-center">
        <span className="text-xs font-bold" style={{ color, fontFamily: "'Sora', sans-serif" }}>{value}</span>
      </td>
    );
  }
  return (
    <td className="py-3 px-4 text-center">
      {value ? (
        <div className="w-5 h-5 rounded-full flex items-center justify-center mx-auto"
          style={{ background: `${color}14` }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M5 13L9 17L19 7" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : (
        <div className="w-1.5 h-1.5 rounded-full bg-gray-200 mx-auto" />
      )}
    </td>
  );
}

export default function PricingComparison() {
  return (
    <section className="relative w-full py-24 lg:py-28 overflow-hidden" style={{ background: "white" }}>
      <div className="relative max-w-5xl mx-auto px-6 lg:px-10">

        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-8 bg-gray-200 rounded-full" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400"
              style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.18em" }}>
              Full comparison
            </span>
            <div className="h-px w-8 bg-gray-200 rounded-full" />
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight"
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Compare all features
          </h2>
        </motion.div>

        <motion.div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid #f1f1f3", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6 }}
        >
          <table className="w-full">
            {/* Header */}
            <thead>
              <tr style={{ background: "#fafafa", borderBottom: "1px solid #f1f1f3" }}>
                <th className="py-4 px-5 text-left text-xs font-bold text-gray-400 uppercase tracking-widest"
                  style={{ fontFamily: "'DM Sans', sans-serif", width: "45%" }}>
                  Feature
                </th>
                {[
                  { name: "Free",       color: planColors.free },
                  { name: "Growth",     color: planColors.growth },
                  { name: "Enterprise", color: planColors.enterprise },
                ].map((p) => (
                  <th key={p.name} className="py-4 px-4 text-center">
                    <span className="text-xs font-bold" style={{ color: p.color, fontFamily: "'Sora', sans-serif" }}>
                      {p.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {categories.map((cat) => (
                // 2. Bound the top element inside the loop with an explicit unique key
                <Fragment key={`group-${cat}`}>
                  {/* Category header row */}
                  <tr style={{ background: "#f8f7ff" }}>
                    <td colSpan={4} className="py-2.5 px-5">
                      <span className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "#8B7FF5", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.15em" }}>
                        {cat}
                      </span>
                    </td>
                  </tr>

                  {/* Feature rows loop */}
                  {rows.filter(r => r.category === cat).map((row, i) => (
                    <tr key={row.feature}
                      style={{ borderBottom: "1px solid #f9fafb", background: i % 2 === 0 ? "white" : "#fefefe" }}>
                      <td className="py-3 px-5 text-sm text-gray-600"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        {row.feature}
                      </td>
                      <Cell value={row.free} color={planColors.free} />
                      <Cell value={row.growth} color={planColors.growth} />
                      <Cell value={row.enterprise} color={planColors.enterprise} />
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
