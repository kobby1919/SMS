import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";

test("homepage uses approved static artwork without experimental motion layers", () => {
  const page = readFileSync("src/app/(marketing)/page.tsx", "utf8");
  const hero = readFileSync("src/components/hero/HeroStill.tsx", "utf8");
  assert.match(page, /<HeroStill \/>/);
  assert.match(hero, /School management,/);
  assert.match(hero, /in one place\./);
  assert.doesNotMatch(hero, /Daily school work,/);
  assert.match(readFileSync("src/components/FeaturesSection.tsx", "utf8"), /Daily school work,/);
  assert.match(hero, /One platform\. Every part of your school, finally connected\./);
  assert.match(hero, /edujay-school-work-approved\.png/);
  assert.doesNotMatch(hero, /ClashSignature|styles\.signature|SignatureReveal/);
  assert.doesNotMatch(hero, /motion-sheets|motion-base|<canvas|<video/);
  const hash = createHash("sha256").update(readFileSync("public/edujay-school-work-approved.png")).digest("hex");
  assert.equal(hash, "5a1b13f2511ad612b5dced1ddd4b09be9efc8483ab0b58419bd2ac61f8c71bb4");
});

test("public page openings, features closing section and footer use consistent charcoal", () => {
  for (const path of ["src/components/features-page/FeaturesHero.tsx", "src/components/features-page/FeaturesCTA.tsx", "src/components/howItWorks/HowItWorksHero.tsx", "src/components/pricing/PricingHero.tsx", "src/components/about-page/AboutHero.tsx", "src/components/Footer.tsx"]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /background: "#17191b"/);
    assert.doesNotMatch(source, /rgba\(32,44,92|#0a0916|#080B18/);
  }
});

test("homepage onboarding background follows charcoal without changing its content", () => {
  const source = readFileSync("src/components/HowItWorks.tsx", "utf8");
  assert.match(source, /ink:\s*"#17191b"/);
  assert.doesNotMatch(source, /rgba\(32,44,92|#10131C/);
  assert.match(source, /Introduce Your School/);
});

test("school access form matches charcoal and retains the legacy waitlist redirect", () => {
  const source = readFileSync("src/components/SchoolAccessRequest.tsx", "utf8");
  assert.match(source, /background:\s*"#17191b"/);
  assert.doesNotMatch(source, /#080B18|#0f1124|radial-gradient\(circle/);
  assert.match(readFileSync("src/app/(marketing)/waitlist/page.tsx", "utf8"), /redirect\("\/request-access"\)/);
});

test("entrance reveals remain and mobile hides the book without a signature", () => {
  const css = readFileSync("src/components/hero/HeroStill.module.css", "utf8");
  assert.match(css, /\.artwork \{ display:none; \}/);
  assert.doesNotMatch(css, /blur\(/);
  const hero = readFileSync("src/components/hero/HeroStill.tsx", "utf8");
  assert.match(hero, /setTimeout\(\(\) => setEntered\(true\), 60\)/);
  assert.match(css, /slideUp \.8s cubic-bezier\(\.22,1,\.36,1\) \.3s both/);
  assert.match(css, /slideUp \.75s ease \.45s both/);
  assert.match(css, /slideUp \.7s ease \.58s both/);
  assert.match(css, /\.attribution \{ animation:slideUp \.7s ease \.72s both/);
  assert.match(css, /mix-blend-mode:lighten/);
  assert.match(hero, /document\.fonts\.ready\.then\(restart\)/);
  assert.match(hero, /visibilitychange/);
  assert.match(hero, /pageshow/);
  assert.doesNotMatch(css, /animation:none/);
  assert.doesNotMatch(css, /letterReveal/);
});
