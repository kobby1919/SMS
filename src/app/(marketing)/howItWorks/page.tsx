import HomepageNavbar from "@/src/components/HomepageNavbar";
import Footer from "@/src/components/Footer";
import HowItWorksHero from "@/src/components/howItWorks/HowItWorksHero";
import HIWSteps from "@/src/components/howItWorks/HIWSteps";
import HIWFAQ from "@/src/components/howItWorks/HIWFAQ";
import CTABanner from "@/src/components/CTABanner";

export const metadata = {
  title: "How It Works — EduJay",
  description: "Set up your school, add your people, and run everything — in three simple steps. No IT team needed.",
};

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen">
      <div style={{ background: "#0a0916" }}>
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