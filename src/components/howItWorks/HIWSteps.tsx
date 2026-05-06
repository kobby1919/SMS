"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { SetupVisual, PeopleVisual, RunVisual } from "./StepVisuals";

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
  time: string;
  flip: boolean;
  bg: string;
  visual: ReactNode;
};

const steps: Step[] = [
  {
    id: "step-1",
    number: "01",
    label: "Setup",
    color: "#8B7FF5",
    heading: "Set up your",
    headingAccent: "school.",
    description: "Start by creating your school profile. Enter your school name, academic year, current term, and region. Then add your classes — from Nursery all the way to JHS 3 — and set up your subjects. EduJay structures itself around your school, not the other way around.",
    details: [
      { heading: "Takes under 10 minutes", text: "The entire school setup — profile, classes, and subjects — is designed to be completed in a single session. No back-and-forth, no waiting." },
      { heading: "Ghana's school structure built in", text: "Nursery, KG, Class 1–6, JHS 1–3 with optional A/B sections. EduJay already knows how Ghanaian schools are structured." },
      { heading: "Academic year & term configuration", text: "Set your academic year and active term once. Every module — attendance, grading, results, fees — automatically aligns to it." },
      { heading: "Subjects assigned per class", text: "Assign subjects to classes and they flow through to timetables, CA scoring, and results automatically." },
    ],
    time: "~10 mins",
    flip: false,
    bg: "white",
    visual: <SetupVisual color="#8B7FF5" />,
  },
  {
    id: "step-2",
    number: "02",
    label: "People",
    color: "#10B981",
    heading: "Add your",
    headingAccent: "people.",
    description: "Invite your teachers, enroll students, and link parents — all from one place. Every person gets a secure login through Clerk, and their view of EduJay is shaped entirely by their role. A teacher sees their classes. A parent sees their child. An admin sees everything.",
    details: [
      { heading: "Teachers onboard in seconds", text: "Enter a teacher's name and email, assign their classes and subjects, and send an invite. They log in and everything is waiting for them." },
      { heading: "Students enrolled per class", text: "Add students individually or import in bulk. Each student is linked to their class, and their record follows them through every term." },
      { heading: "Parents linked to their children", text: "Parents are connected directly to their child's account. They see attendance, results, and fee status — nothing more, nothing less." },
      { heading: "Role-based access from day one", text: "Powered by Clerk — every user has their own secure login. No shared passwords, no access confusion." },
    ],
    time: "~20 mins",
    flip: true,
    bg: "#f8f7ff",
    visual: <PeopleVisual color="#10B981" />,
  },
  {
    id: "step-3",
    number: "03",
    label: "Run",
    color: "#F59E0B",
    heading: "Run",
    headingAccent: "everything.",
    description: "With your school configured and your people added, every module is live and ready. Teachers mark attendance from their phones. Grades compute as scores are entered. The bursar tracks payments. Admins see the full picture from the dashboard. No setup required per module — it all just works.",
    details: [
      { heading: "Attendance is live immediately", text: "Teachers open EduJay on any device, pick their class, and mark. Absences trigger alerts automatically. No paper, no delays." },
      { heading: "Grades flow from CA to results", text: "Enter CA component scores and exam scores — grades compute and feed straight into the term results report. One less thing to calculate." },
      { heading: "Timetable is accessible to all roles", text: "Build the timetable once and every teacher, student, and parent sees their own filtered view of it automatically." },
      { heading: "Finance and bursar dashboard live", text: "The bursar logs payments as they come in. The ledger updates in real time. End-of-term reports generate in one click." },
    ],
    time: "Day one",
    flip: false,
    bg: "white",
    visual: <RunVisual color="#F59E0B" />,
  },
];

function StepBlock({ step }: { step: Step }) {
  return (
    <section
      id={step.id}
      className="relative w-full py-24 lg:py-32 overflow-hidden"
      style={{ background: step.bg }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at ${step.flip ? "80%" : "20%"} 50%, ${step.color}07 0%, transparent 55%)` }} />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        <div className={`flex flex-col ${step.flip ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-16 lg:gap-20`}>

          {/* Text */}
          <motion.div
            className="flex-1 max-w-lg w-full"
            initial={{ opacity: 0, x: step.flip ? 30 : -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Step number + time badge */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{ background: `${step.color}12`, border: `1px solid ${step.color}28` }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: step.color }} />
                <span className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: step.color, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.15em" }}>
                  Step {step.number} — {step.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#9ca3af" strokeWidth="2" />
                  <path d="M12 6V12L16 14" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-[10px] font-medium text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>{step.time}</span>
              </div>
            </div>

            {/* Heading */}
            <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4"
              style={{ fontFamily: "'Clash Display', sans-serif" }}>
              {step.heading}{" "}
              <span style={{ color: step.color }}>{step.headingAccent}</span>
            </h2>

            {/* Description */}
            <p className="text-base text-gray-500 leading-relaxed mb-8"
              style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
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
                  <div>
                    <div className="text-sm font-bold text-gray-800 mb-0.5" style={{ fontFamily: "'Sora', sans-serif" }}>{d.heading}</div>
                    <div className="text-xs text-gray-500 leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>{d.text}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Visual */}
          <motion.div
            className="flex-1 w-full flex items-center justify-center"
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