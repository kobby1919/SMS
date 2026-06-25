import HomepageNavbar from "../../components/HomepageNavbar";
import HeroCarousel from "../../components/hero/HeroCarousel";
import FeaturesSection from "../../components/FeaturesSection";
import HowItWorks from "../../components/HowItWorks";
import DashboardPreview from "../../components/DashboardPreview";
import CTABanner from "../../components/CTABanner";
import Footer from "../../components/Footer";

export default function Home() {
  return (
    /* Full viewport width — no max-width cap at this level */
    <div className="w-full min-h-screen overflow-x-hidden">

      {/* ── DARK ZONE — navbar + hero share one seamless dark background ── */}
      <div className="w-full">
        <HomepageNavbar />
        <HeroCarousel />
      </div>

      {/* ── LIGHT ZONE — all sections below the hero ── */}
      <div className="w-full bg-white">
        <FeaturesSection />
        <HowItWorks />
        <DashboardPreview />
      </div>

      <CTABanner />
      <Footer />
    </div>
  );
}