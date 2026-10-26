import FeatureBlock from "@/src/components/features-page/FeatureBlock";
import FeaturesCTA from "@/src/components/features-page/FeaturesCTA";
import FeaturesHero from "@/src/components/features-page/FeaturesHero";
import { RecordsVisual, AttendanceVisual, TimetableVisual, GradingVisual, ResultsVisual, FinanceVisual, BursarVisual, RolesVisual } from "@/src/components/features-page/FeatureVisuals";
import Footer from "@/src/components/Footer";
import HomepageNavbar from "@/src/components/HomepageNavbar";

export const metadata = {
  title: "Features",
  description: "Explore Edujay's tools for school records, attendance, assessments, timetables, and fees, with role-based access for school teams and parents.",
};

export default function FeaturesPage() {
  return (
    <div className="min-h-screen">
      <div style={{ background: "#080B18" }}>
        <HomepageNavbar />
        <FeaturesHero />
      </div>

      <FeatureBlock
        id="records"
        label="School Records"
        color="#2563a6"
        heading="School records,"
        headingAccent="connected."
        description="Organise students, parents, classes, and staff around your school's structure. Start fresh or bring existing records through a guided import and review."
        benefits={[
          { text: "Maintain student records and class assignments" },
          { text: "Link parents to the students in their care" },
          { text: "Organise staff and their school responsibilities" },
          { text: "Review and reconcile existing records as part of school setup" },
        ]}
        visual={<RecordsVisual color="#2563a6" />}
        bg="white"
      />

      <FeatureBlock
        id="attendance"
        label="Attendance"
        color="#10B981"
        heading="Record attendance."
        headingAccent="Follow up clearly."
        description="Record Present, Absent, Late, and Excused attendance, then review the pattern across classes and students. Follow-up notifications depend on school settings and enabled delivery channels."
        benefits={[
          { text: "Authorised teachers record attendance for their assigned classes" },
          { text: "Administrators review school attendance summaries" },
          { text: "Review attendance history for individual students" },
          { text: "Keep school operating days and attendance expectations in context" },
        ]}
        visual={<AttendanceVisual color="#10B981" />}
        flip
        bg="#fafafa"
      />

      <FeatureBlock
        id="timetable"
        label="Teaching & Timetables"
        color="#8B7FF5"
        heading="Organise lessons"
        headingAccent="and teaching responsibilities."
        description="Bring class schedules, subjects, and teacher assignments into a shared school structure. Review your timetable so staff can see when and where they are expected to teach."
        benefits={[
          { text: "Organise subjects and class teaching assignments" },
          { text: "Schedule lessons within the school's academic structure" },
          { text: "Review class and teacher timetables" },
          { text: "Use assigned responsibilities to support daily teaching" },
        ]}
        visual={<TimetableVisual color="#8B7FF5" />}
        bg="white"
      />

      <FeatureBlock
        id="grading"
        label="Assessments"
        color="#F59E0B"
        heading="Record scores."
        headingAccent="Review academic progress."
        description="Record class assessments and exam scores using the configured assessment structure. Calculations support teacher and administrator review; they do not replace checking the underlying scores."
        benefits={[
          { text: "Authorised teachers record scores for assigned subjects and classes" },
          { text: "Use configured assessment and exam weighting" },
          { text: "Review missing scores and academic progress" },
          { text: "Carry reviewed assessment information into report preparation" },
        ]}
        visual={<GradingVisual color="#F59E0B" />}
        flip
        bg="#fafafa"
      />

      <FeatureBlock
        id="results"
        label="Reports"
        color="#60A5FA"
        heading="Turn reviewed results"
        headingAccent="into term reports."
        description="Check assessment completeness, review results, and publish reports through the school's authorised workflow. Prepare printable term reports from the recorded academic information."
        benefits={[
          { text: "Review results by student, class, term, and academic year" },
          { text: "Check report readiness before publication" },
          { text: "Include recorded assessment and exam results" },
          { text: "Give parents access to published reports for linked children" },
        ]}
        visual={<ResultsVisual color="#60A5FA" />}
        bg="white"
      />

      <FeatureBlock
        id="finance"
        label="Fees & Receipts"
        color="#FB7185"
        heading="Keep bills, payments,"
        headingAccent="and balances connected."
        description="Create fee bills, apply approved discounts, record confirmed payments, and issue receipts. Online collections require the school's own verified payment-provider setup and activation."
        benefits={[
          { text: "Review billed amounts, confirmed payments, and outstanding balances" },
          { text: "Apply authorised discounts with a record of the change" },
          { text: "Keep receipts linked to confirmed payment records" },
          { text: "Distinguish payment recording from online payment collection" },
        ]}
        visual={<FinanceVisual color="#FB7185" />}
        flip
        bg="#fafafa"
      />

      <FeatureBlock
        id="bursar"
        label="Bursar Workspace"
        color="#A855F7"
        heading="A focused workspace"
        headingAccent="for your finance team."
        description="Give bursars a dedicated place to review payments, collections, balances, and financial reports. Recorded totals support reconciliation; they do not replace checking provider and bank records."
        benefits={[
          { text: "Review collection summaries and payment history" },
          { text: "Find students with outstanding fee balances" },
          { text: "Record payments within authorised finance permissions" },
          { text: "Use financial reports to support management review" },
        ]}
        visual={<BursarVisual color="#A855F7" />}
        bg="white"
      />

      <FeatureBlock
        id="roles"
        label="Role-Based Access"
        color="#F59E0B"
        heading="Access matched"
        headingAccent="to responsibilities."
        description="Administrators, teachers, bursars, and parents have different responsibilities. Edujay scopes access to the person's school, role, and relevant records."
        benefits={[
          { text: "Administrators manage school setup and authorised school records" },
          { text: "Teachers work with their assigned teaching responsibilities" },
          { text: "Bursars use dedicated finance permissions; admin access alone does not grant money-recording rights" },
          { text: "Parents access records for their linked children" },
        ]}
        visual={<RolesVisual />}
        flip
        bg="#fafafa"
      />

      <FeaturesCTA />
      <Footer />
    </div>
  );
}
