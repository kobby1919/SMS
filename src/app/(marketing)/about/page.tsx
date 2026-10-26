import AboutHero from "@/src/components/about-page/AboutHero";
import AboutMission from "@/src/components/about-page/AboutMission";
import AboutStory from "@/src/components/about-page/AboutStory";
import AboutTeam from "@/src/components/about-page/AboutTeam";
import AboutValues from "@/src/components/about-page/AboutValues";
import CTABanner from "@/src/components/CTABanner";
import Footer from "@/src/components/Footer";
import HomepageNavbar from "@/src/components/HomepageNavbar"

export const metadata = {
  title: "About",
  description: "Meet Edujay, a school management platform developed by MiqraTech Consult, and the people and principles behind it.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <div style={{ background: "#080B18" }}>
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
