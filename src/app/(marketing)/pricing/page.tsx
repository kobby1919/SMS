import HomepageNavbar from "@/src/components/HomepageNavbar";
import Footer from "@/src/components/Footer";
import PricingHero from "@/src/components/pricing/PricingHero";
import PricingPlans from "@/src/components/pricing/PricingPlans";
import PricingComparison from "@/src/components/pricing/PricingComparison";
import PricingFAQ from "@/src/components/pricing/PricingFAQ";
import CTABanner from "@/src/components/CTABanner";

export const metadata = {
  title: "Pricing",
  description: "Request an annual Edujay school package quotation from MiqraTech Consult, with clear inclusions, agreed onboarding scope, and separately disclosed optional costs.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <div style={{ background: "#080B18" }}>
        <HomepageNavbar />
        <PricingHero />
      </div>
      <div className="bg-white">
        <PricingPlans />
        <PricingComparison />
        <PricingFAQ />
      </div>
      <CTABanner />
      <Footer />
    </div>
  );
}
