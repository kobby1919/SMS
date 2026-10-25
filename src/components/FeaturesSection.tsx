"use client";

import { ArrowRight, BookOpenCheck, ClipboardCheck, FileChartColumnIncreasing, FolderOpen, Receipt, UsersRound } from "lucide-react";

const features = [
  { title: "School Records", label: "School records", icon: FolderOpen, color: "#2563a6", description: "Organise students, guardians, classes, and staff in one place.", detail: "Student and guardian records" },
  { title: "Attendance & Teaching", label: "Daily teaching", icon: ClipboardCheck, color: "#087f68", description: "Record attendance and manage teaching schedules across your school.", detail: "Attendance and timetables" },
  { title: "Assessments & Reports", label: "Academic progress", icon: FileChartColumnIncreasing, color: "#936013", description: "Record assessment scores, review results, and prepare term reports.", detail: "Class assessments and term results" },
  { title: "Fees & Receipts", label: "School finance", icon: Receipt, color: "#b44261", description: "Manage bills, record confirmed payments, and track outstanding balances.", detail: "Bills, balances, and receipts" },
  { title: "Role-Based Access", label: "People & permissions", icon: UsersRound, color: "#7551b2", description: "Give administrators, teachers, bursars, and parents access appropriate to their responsibilities.", detail: "School teams and parent access" },
  { title: "Guided School Setup", label: "Getting started", icon: BookOpenCheck, color: "#16788a", description: "Start fresh or bring existing records through a reviewed migration process.", detail: "Fresh setup or existing records" },
];

const steps = [
  { title: "Request access", description: "Tell us about your school and who we should contact." },
  { title: "School review", description: "We review your request and invite your first administrator." },
  { title: "Guided setup", description: "Set up your school and start fresh or bring existing records." },
  { title: "Review and begin", description: "Check your setup and records before your team begins." },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="ej-feat" aria-labelledby="ej-features-heading">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        .ej-feat, .ej-feat * { box-sizing: border-box; letter-spacing: 0; }
        .ej-feat { scroll-margin-top: 88px; background: #f8f7ff; padding: 80px 0 64px; color: #111827; font-family: 'DM Sans', sans-serif; }
        .ej-feat-inner { max-width: 1280px; padding: 0 40px; margin: 0 auto; }
        .ej-feat-header { max-width: 680px; margin-bottom: 36px; }
        .ej-feat-eyebrow { display: flex; align-items: center; gap: 12px; margin: 0 0 16px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #626478; }
        .ej-feat-eyebrow::before { content: ''; width: 32px; height: 1px; background: #b5b5c9; }
        .ej-feat h2 { font-family: 'Clash Display', 'Sora', sans-serif; font-size: 48px; font-weight: 800; line-height: 1.16; margin: 0 0 18px; }
        .ej-feat h2 span { color: #7960d9; }
        .ej-feat-intro { font-size: 17px; line-height: 1.8; color: #565b6d; margin: 0; }
        .ej-feat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid #dcdce8; border-left: 1px solid #dcdce8; }
        .ej-feat-card { min-width: 0; min-height: 280px; padding: 28px; border-right: 1px solid #dcdce8; border-bottom: 1px solid #dcdce8; background: #ffffffb8; display: flex; flex-direction: column; transition: background .2s ease; }
        .ej-feat-card:hover { background: #fff; }
        .ej-feat-card-top { display: flex; align-items: center; gap: 14px; min-height: 42px; margin-bottom: 22px; }
        .ej-feat-icon { width: 42px; height: 42px; flex: 0 0 42px; display: grid; place-items: center; border: 1px solid currentColor; background: #fff; }
        .ej-feat-label { font-size: 11px; font-weight: 700; text-transform: uppercase; line-height: 1.5; }
        .ej-feat h3 { font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700; line-height: 1.5; margin: 0 0 12px; }
        .ej-feat-description { margin: 0 0 24px; font-size: 15px; line-height: 1.75; color: #535969; }
        .ej-feat-detail { margin: auto 0 0; padding-top: 14px; border-top: 1px solid #e7e7ef; font-size: 12px; line-height: 1.6; color: #646879; }
        .ej-feat-footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 24px 0 36px; }
        .ej-feat-footer p { margin: 0; font-size: 14px; line-height: 1.7; color: #626778; max-width: 650px; }
        .ej-feat a { text-decoration: none; }
        .ej-feat-link { color: #5544b7; display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; flex-shrink: 0; min-height: 44px; }
        .ej-feat a:focus-visible { outline: 3px solid #6655c4; outline-offset: 5px; }
        .ej-feat-start { border-top: 1px solid #dcdce8; padding-top: 32px; }
        .ej-feat-start-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
        .ej-feat-start h3 { font-family: 'Clash Display', 'Sora', sans-serif; font-size: 26px; margin: 0; }
        .ej-feat-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 28px; list-style: none; margin: 0; padding: 0; }
        .ej-feat-step { min-width: 0; border-top: 2px solid #d8d3ee; padding-top: 16px; }
        .ej-feat-step-number { color: #7960d9; font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 700; }
        .ej-feat-step h4 { margin: 12px 0 8px; font-family: 'Sora', sans-serif; font-size: 15px; line-height: 1.5; }
        .ej-feat-step p { margin: 0; font-size: 14px; line-height: 1.75; color: #626778; }
        @media (max-width: 1000px) { .ej-feat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .ej-feat-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 600px) {
          .ej-feat { padding: 48px 0; } .ej-feat-inner { padding: 0 24px; }
          .ej-feat h2 { font-size: 34px; } .ej-feat-intro { font-size: 16px; }
          .ej-feat-grid { grid-template-columns: minmax(0, 1fr); } .ej-feat-card { padding: 24px; min-height: 264px; }
          .ej-feat-footer, .ej-feat-start-header { flex-direction: column; align-items: flex-start; gap: 12px; }
          .ej-feat-start h3 { font-size: 24px; } .ej-feat-steps { grid-template-columns: minmax(0, 1fr); gap: 24px; }
        }
        @media (prefers-reduced-motion: reduce) { .ej-feat-card { transition: none; } }
      `}</style>
      <div className="ej-feat-inner">
        <header className="ej-feat-header">
          <p className="ej-feat-eyebrow">Built around your school</p>
          <h2 id="ej-features-heading">Daily school work,<br /><span>connected.</span></h2>
          <p className="ej-feat-intro">Manage school records, attendance, assessments, fees, and parent access in one place, with guided setup for your school.</p>
        </header>
        <div className="ej-feat-grid">
          {features.map(({ title, label, description, detail, icon: Icon, color }) => (
            <article className="ej-feat-card" key={title}>
              <div className="ej-feat-card-top" style={{ color }}>
                <span className="ej-feat-icon"><Icon size={23} strokeWidth={1.7} aria-hidden="true" /></span>
                <span className="ej-feat-label">{label}</span>
              </div>
              <h3>{title}</h3>
              <p className="ej-feat-description">{description}</p>
              <p className="ej-feat-detail">{detail}</p>
            </article>
          ))}
        </div>
        <div className="ej-feat-footer">
          <p>Your school is set up before your team begins. Online payments require separate provider activation.</p>
          <a className="ej-feat-link" href="/features">Explore all features <ArrowRight size={16} aria-hidden="true" /></a>
        </div>
        <section className="ej-feat-start" aria-labelledby="ej-feat-start-heading">
          <div className="ej-feat-start-header">
            <h3 id="ej-feat-start-heading">A guided start for your school.</h3>
            <a className="ej-feat-link" href="/waitlist">Request school access <ArrowRight size={16} aria-hidden="true" /></a>
          </div>
          <ol className="ej-feat-steps">
            {steps.map((step, index) => (
              <li className="ej-feat-step" key={step.title}>
                <span className="ej-feat-step-number" aria-hidden="true">0{index + 1}</span>
                <h4>{step.title}</h4>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}
