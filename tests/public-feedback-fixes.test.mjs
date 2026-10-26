import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(path, "utf8");

test("public page titles rely on the shared Edujay template exactly once", () => {
  for (const [path, title] of [["features", "Features"], ["about", "About"], ["howItWorks", "How It Works"], ["pricing", "Pricing"]]) {
    assert.ok(read(`src/app/(marketing)/${path}/page.tsx`).includes(`title: "${title}"`));
  }
  assert.match(read("src/app/layout.tsx"), /template: "Edujay — %s"/);
});

test("school requests retain review, rate limiting and legacy redirects", () => {
  assert.match(read("src/app/(marketing)/waitlist/page.tsx"), /redirect\("\/request-access"\)/);
  assert.match(read("src/app/contact/page.tsx"), /redirect\("\/request-access"\)/);
  assert.match(read("src/proxy.ts"), /"\/request-access"/);
  const form = read("src/components/SchoolAccessRequest.tsx");
  assert.match(form, /await joinWaitlist\(state.values\)/);
  assert.match(form, /invitation follows approval/);
  assert.doesNotMatch(form, /Join the [Ww]aitlist|Early access/);
  const action = read("src/lib/actions/waitlistActions.ts");
  assert.match(action, /enforceActionRateLimit/);
  assert.match(action, /prisma.waitlistEntry.create/);
  assert.doesNotMatch(action, /prisma.school.create|prisma.schoolInvite.create/);
});

test("marketing anchors use Lenis integration and one onboarding destination", () => {
  const provider = read("src/components/LenisProvider.tsx");
  assert.match(provider, /anchors:\s*\{/);
  assert.match(provider, /stopInertiaOnNavigate: true/);
  for (const path of ["src/components/CTABanner.tsx", "src/components/features-page/FeaturesCTA.tsx"]) {
    assert.match(read(path), /href="\/howItWorks"/);
    assert.doesNotMatch(read(path), /href="\/?#how-it-works"/);
  }
});

test("footer uses the confirmed email without placeholder claims", () => {
  const footer = read("src/components/Footer.tsx");
  assert.match(footer, /mailto:miqratechc@gmail.com/);
  assert.match(footer, /Edujay · MiqraTech Consult\./);
  assert.doesNotMatch(footer, /hello@edujay.com.gh|Accra, Ghana|All systems operational|href: "#"|Built with ❤️/);
});

test("founder comes first and demonstration context remains without repeated captions", () => {
  const team = read("src/components/about-page/AboutTeam.tsx");
  assert.ok(team.indexOf('name: "Robert Ankrah"') < team.indexOf('name: "Samuel Kwabena Assan"'));
  assert.match(team, /Designed and built Edujay/);
  for (const file of ["src/components/features-page/FeatureBlock.tsx", "src/components/howItWorks/HIWSteps.tsx"]) assert.doesNotMatch(read(file), /Illustrative example · Sample data/);
  assert.match(read("src/components/features-page/FeaturesHero.tsx"), /demonstration records/);
  assert.match(read("src/components/DashboardPreview.tsx"), /demonstration records/);
});

test("unused hero demo link and pilot badge are absent without changing Feedback 1 copy", () => {
  const hero = read("src/components/hero/HeroCarousel.tsx");
  assert.doesNotMatch(hero, /Book a demo|href="#demo"|Now accepting pilot schools|Join the Waitlist/);
  assert.match(hero, /GHANA&apos;S SCHOOLS DESERVE/);
  assert.match(hero, /school management, simplified/);
});
