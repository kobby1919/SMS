import FeatureBlock from "@/src/components/features-page/FeatureBlock";
import FeaturesCTA from "@/src/components/features-page/FeaturesCTA";
import FeaturesHero from "@/src/components/features-page/FeaturesHero";
import { AttendanceVisual, BursarVisual, FinanceVisual, GradingVisual, ResultsVisual, RolesVisual, TimetableVisual } from "@/src/components/features-page/FeatureVisuals";
import Footer from "@/src/components/Footer";
import HomepageNavbar from "@/src/components/HomepageNavbar"


export const metadata = {
  title: "Features — Edujay",
  description: "Every tool your school needs. Attendance, grading, timetables, results, finance, and a dedicated bursar dashboard — all in one platform.",
};

export default function FeaturesPage() {
  return (
    <div className="min-h-screen">
      <div style={{ background: "#0a0916" }}>
        <HomepageNavbar />
        <FeaturesHero />
      </div>

      {/* Alternating feature blocks */}
      <FeatureBlock
        id="attendance"
        label="Attendance"
        color="#10B981"
        heading="Mark smarter."
        headingAccent="Miss nothing."
        description="Real-time attendance marking with four statuses — PRESENT, ABSENT, LATE, and EXCUSED. Teachers mark in seconds, admins see the full picture, and parents get notified automatically when something's off."
        benefits={[
          { text: "One-tap marking with PRESENT, ABSENT, LATE, EXCUSED statuses" },
          { text: "Consecutive absence alerts sent automatically to parents and admins" },
          { text: "Role-filtered views — teachers see their class, admins see the whole school" },
          { text: "Weekly and daily attendance summaries with visual breakdowns" },
          { text: "Full attendance history per student, exportable at any time" },
        ]}
        visual={<AttendanceVisual color="#10B981" />}
        bg="white"
      />

      <FeatureBlock
        id="grading"
        label="Grading & CA"
        color="#F59E0B"
        heading="Grades that"
        headingAccent="compute themselves."
        description="Set your CA-to-exam weight split once — 30/70, 50/50, whatever your school uses — and Edujay handles the rest. Teachers enter scores, grades compute automatically, and results are ready the moment the last mark goes in."
        benefits={[
          { text: "Fully configurable CA-to-exam weight splits per school or class" },
          { text: "Automatic grade letter computation — A, B, C, D, F" },
          { text: "Teacher-centric score entry with role-based access control" },
          { text: "CA scores feed directly into the results report, zero manual steps" },
          { text: "School-wide and per-class CA overview on the admin dashboard" },
        ]}
        visual={<GradingVisual color="#F59E0B" />}
        flip
        bg="#fafafa"
      />

      <FeatureBlock
        id="timetable"
        label="Timetable"
        color="#8B7FF5"
        heading="Zero conflicts."
        headingAccent="Perfect schedules."
        description="Build your school timetable with real-time conflict detection. Assign teachers, subjects, and periods without overlap — and every role sees a view tailored to them the moment it's published."
        benefits={[
          { text: "Drag-and-assign timetable builder with instant conflict detection" },
          { text: "Separate views for teachers, students, parents, and admins" },
          { text: "Day and week toggle for quick navigation" },
          { text: "Subject colour coding for at-a-glance clarity" },
          { text: "Changes publish instantly — no emails, no printouts needed" },
        ]}
        visual={<TimetableVisual color="#8B7FF5" />}
        bg="white"
      />

      <FeatureBlock
        id="results"
        label="Results"
        color="#60A5FA"
        heading="Term reports,"
        headingAccent="in one click."
        description="Generate clean, structured term result reports for every student in your school. From Nursery to JHS 3 — Edujay handles Ghana's full school structure and produces professional-grade reports instantly."
        benefits={[
          { text: "Printable and exportable PDF result sheets per student" },
          { text: "Supports all Ghana school levels — Nursery, KG, Class 1–6, JHS 1–3" },
          { text: "Shows CA score, exam score, total, grade letter, and class rank" },
          { text: "School-wide results overview for admin and headmasters" },
          { text: "Archived automatically by term and academic year" },
        ]}
        visual={<ResultsVisual color="#60A5FA" />}
        flip
        bg="#fafafa"
      />

      <FeatureBlock
        id="finance"
        label="Finance & Payments"
        color="#FB7185"
        heading="Every cedi,"
        headingAccent="accounted for."
        description="Track student fee bills, log payments, and flag overdue accounts — all in one place. Edujay's finance module keeps your school's money clear and your bursar's desk clean."
        benefits={[
          { text: "Per-student fee ledger with bill, paid, and outstanding breakdown" },
          { text: "Payment status tracking — Paid, Pending, Overdue at a glance" },
          { text: "Supports multiple payment methods — cash, mobile money, bank transfer" },
          { text: "Overdue flags with optional parent notification" },
          { text: "Term-end financial summary with export to PDF or Excel" },
        ]}
        visual={<FinanceVisual color="#FB7185" />}
        bg="white"
      />

      <FeatureBlock
        id="bursar"
        label="Bursar Dashboard"
        color="#A855F7"
        heading="A command center"
        headingAccent="for your bursar."
        description="The bursar's office runs on numbers — and Edujay gives them a dedicated space to stay on top of every cedi. Daily collections, outstanding balances, payment history, and one-click term reports. Everything reconciles automatically so end-of-term is never a scramble."
        benefits={[
          { text: "Daily collection summary — total received, number of payments, breakdown by method" },
          { text: "Per-student fee ledger with full payment history and outstanding balance" },
          { text: "Overdue account flagging with direct parent notification from the dashboard" },
          { text: "One-click term financial report — total billed, collected, and outstanding" },
          { text: "Export to PDF and Excel for audits, management meetings, and records" },
          { text: "Auto-reconciliation — ledger updates the moment a payment is logged" },
        ]}
        visual={<BursarVisual color="#A855F7" />}
        flip
        bg="#faf8ff"
      />

      <FeatureBlock
        id="roles"
        label="Role-Based Access"
        color="#F59E0B"
        heading="Right person,"
        headingAccent="right view. Always."
        description="Edujay is built around roles. Admins, teachers, students, and parents each log in to a version of Edujay shaped exactly for them — no clutter, no irrelevant data, no confusion."
        benefits={[
          { text: "Admins see the full school — every class, teacher, student, and report" },
          { text: "Teachers see only their assigned classes, subjects, and students" },
          { text: "Students access their own timetable, results, and attendance history" },
          { text: "Parents track their child's attendance, results, and fee status in real time" },
          { text: "Powered by Clerk — secure, fast authentication for every role" },
        ]}
        visual={<RolesVisual />}
        bg="white"
      />

      <FeaturesCTA />
      <Footer />
    </div>
  );
}
