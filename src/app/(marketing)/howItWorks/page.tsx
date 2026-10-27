import HomepageNavbar from "@/src/components/HomepageNavbar";
import Footer from "@/src/components/Footer";
import HowItWorksHero from "@/src/components/howItWorks/HowItWorksHero";
import HIWSteps from "@/src/components/howItWorks/HIWSteps";
import HIWFAQ from "@/src/components/howItWorks/HIWFAQ";
import CTABanner from "@/src/components/CTABanner";

export const metadata = {
  title: "How It Works",
  description: "Learn how Edujay guides your school through access review, fresh setup or reviewed record migration, and readiness checks before daily use.",
};

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen">
      <div style={{ background: "#17191b" }}>
        <HomepageNavbar />
        <HowItWorksHero />
      </div>
      <div className="bg-white">
        <HIWSteps />
        <HIWFAQ />
      </div>
      <CTABanner />
      <Footer />
    </div>
  );
}
