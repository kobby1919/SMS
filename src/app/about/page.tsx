import AboutHero from "@/src/components/about-page/AboutHero";
import AboutMission from "@/src/components/about-page/AboutMission";
import AboutStory from "@/src/components/about-page/AboutStory";
import AboutTeam from "@/src/components/about-page/AboutTeam";
import AboutValues from "@/src/components/about-page/AboutValues";
import CTABanner from "@/src/components/CTABanner";
import Footer from "@/src/components/Footer";
import HomepageNavbar from "@/src/components/HomepageNavbar"

export const metadata = {
  title: "About — EduJay",
  description: "Built in Ghana, for Ghana. EduJay is purpose-built school management software for Ghanaian schools.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <div style={{ background: "#0a0916" }}>
        <HomepageNavbar />
        <AboutHero />
      </div>
      <div className="bg-white">
        <AboutMission />
        <AboutStory />
        <AboutValues />
        <AboutTeam />
      </div>
      <CTABanner />
      <Footer />
    </div>
  );
}