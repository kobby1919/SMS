"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { ClipboardCheck } from "lucide-react";
import { AccessVisual, SetupPathsVisual, ReviewVisual } from "./StepVisuals";

type StepDetail = {
  heading: string;
  text: string;
};

type Step = {
  id: string;
  number: string;
  label: string;
  color: string;
  heading: string;
  headingAccent: string;
  description: string;
  details: StepDetail[];
  stage: string;
  flip: boolean;
  bg: string;
  visual: ReactNode;
};

const steps: Step[] = [
  {
    id: "step-1", number: "01", label: "Access", color: "#8B7FF5",
    heading: "Introduce", headingAccent: "your school.",
    description: "Send a school access request so we can understand your needs, discuss the package and onboarding scope, and review your school's request. Once approved, your first administrator receives a school-specific invitation.",
    details: [
      { heading: "Choose an authorised contact", text: "Identify the person who can discuss your school's requirements and coordinate onboarding." },
      { heading: "Discuss needs and scope", text: "Agree what your school will use, which records it will bring, and what the package and onboarding include." },
      { heading: "Review before access", text: "A request begins the conversation. It does not immediately activate a school or create accounts for everyone." },
      { heading: "Invite the first administrator", text: "After approval, the invited administrator signs in and begins the school's setup." },
    ],
    stage: "Access review", flip: false, bg: "white",
    visual: <AccessVisual color="#8B7FF5" />,
  },
  {
    id: "step-2", number: "02", label: "Setup", color: "#10B981",
    heading: "Set up your school", headingAccent: "and records.",
    description: "Configure your academic year, terms, classes, subjects, and staff responsibilities. Add student records and parent links, then follow the setup route that fits your school: start fresh or bring existing records through guided migration.",
    details: [
      { heading: "Build the academic foundation", text: "Review your school profile, academic periods, classes, subjects, and teaching assignments." },
      { heading: "Start fresh", text: "Enter the records your school needs through the normal school setup and authorised record-entry workflows." },
      { heading: "Bring existing records", text: "Agree source files and scope, then upload, validate, review, and reconcile records through the migration workspace. Uploading a spreadsheet is not approval of its contents." },
      { heading: "Review people and opening balances", text: "Check student and parent links, assign staff responsibilities, and reconcile any opening fee balances against the agreed source records." },
    ],
    stage: "Guided setup", flip: true, bg: "#f8f7ff",
    visual: <SetupPathsVisual color="#10B981" />,
  },
  {
    id: "step-3", number: "03", label: "Review", color: "#F59E0B",
    heading: "Review,", headingAccent: "then begin.",
    description: "Check your setup, records, staff access, and any opening financial figures before completing onboarding. Once your school is ready, use Edujay for daily attendance, assessments, bills, receipts, and reports.",
    details: [
      { heading: "Confirm records and permissions", text: "Check class assignments, student-parent links, and that each invited person has the appropriate school and role access." },
      { heading: "Approve the opening position", text: "Where existing records are imported, review reconciliation and obtain the school's approval before completing migration." },
      { heading: "Begin daily school work", text: "Teachers record attendance and assessments, bursars manage authorised finance tasks, and parents access records for their linked children." },
      { heading: "Activate external services separately", text: "Online payments require the school's verified provider setup. External notifications depend on configured and verified delivery channels; school setup does not activate them automatically." },
    ],
    stage: "Readiness review", flip: false, bg: "white",
    visual: <ReviewVisual color="#F59E0B" />,
  },
];

function StepBlock({ step }: { step: Step }) {
  return (
    <section
      id={step.id}
      className="relative w-full py-24 lg:py-32 overflow-hidden scroll-mt-20"
      style={{ background: step.bg }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at ${step.flip ? "80%" : "20%"} 50%, ${step.color}07 0%, transparent 55%)` }} />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        <div className={`flex flex-col ${step.flip ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-16 lg:gap-20`}>

          {/* Text */}
          <motion.div
            className="flex-1 max-w-lg w-full min-w-0"
            initial={{ opacity: 0, x: step.flip ? 30 : -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Step number and onboarding stage */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{ background: `${step.color}12`, border: `1px solid ${step.color}28` }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: step.color }} />
                <span className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: step.color, fontFamily: "var(--font-body)", letterSpacing: "0.15em" }}>
                  Step {step.number} — {step.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
                <ClipboardCheck size={12} color="#6b7280" aria-hidden="true" />
                <span className="text-[10px] font-medium text-gray-500" style={{ fontFamily: "var(--font-body)" }}>{step.stage}</span>
              </div>
            </div>

            {/* Heading */}
            <h2 className="text-3xl min-[360px]:text-4xl xl:text-5xl font-extrabold text-gray-900 leading-tight mb-4"
              style={{ fontFamily: "var(--font-heading)" }}>
              {step.heading}{" "}
              <span style={{ color: step.color }}>{step.headingAccent}</span>
            </h2>

            {/* Description */}
            <p className="text-base text-gray-500 leading-relaxed mb-8"
              style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}>
              {step.description}
            </p>

            {/* Detail cards */}
            <div className="flex flex-col gap-3">
              {step.details.map((d, i) => (
                <motion.div
                  key={i}
                  className="flex gap-3 p-4 rounded-xl"
                  style={{ background: `${step.color}06`, border: `1px solid ${step.color}14` }}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${step.color}18`, border: `1px solid ${step.color}30` }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13L9 17L19 7" stroke={step.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-800 mb-0.5" style={{ fontFamily: "var(--font-body)" }}>{d.heading}</div>
                    <div className="text-xs text-gray-500 leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>{d.text}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Visual */}
          <motion.div
            className="flex-1 w-full min-w-0 flex flex-col items-center justify-center"
            initial={{ opacity: 0, x: step.flip ? -30 : 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            {step.visual}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default function HIWSteps() {
  return (
    <>
      {steps.map((step) => (
        <StepBlock key={step.id} step={step} />
      ))}
    </>
  );
}
