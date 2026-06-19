"use client";

import React, { useEffect, useRef, useState } from "react";

interface SigPath {
  id: string;
  d: string;
  dur: number;
  strokeWidth?: number;
  opacity?: number;
}

const SIG_PATHS: SigPath[] = [
  {
    id: "lE",
    d: "M65.2,191.8 Q44.4,191.8 30.9,186.0 Q17.4,180.2 10.9,170.8 Q4.4,161.4 4.4,150.8 Q4.4,138.8 10.6,129.0 Q16.8,119.2 26.9,112.0 Q37.0,104.8 49.2,100.6 Q61.4,96.4 73.2,95.8 Q62.8,92.0 56.3,85.3 Q49.8,78.6 49.8,70.6 Q49.8,62.4 54.9,54.9 Q60.0,47.4 68.6,41.1 Q77.2,34.8 88.1,30.2 Q99.0,25.6 110.8,23.1 Q122.6,20.6 133.6,20.6 Q151.4,20.6 162.0,26.6 Q172.6,32.6 172.6,42.0 Q172.6,50.6 163.3,59.0 Q154.0,67.4 137.6,71.0 Q134.4,71.6 133.4,71.6 Q131.2,71.6 131.2,69.8 Q131.2,69.2 131.9,68.9 Q132.6,68.6 135.0,67.8 Q146.8,63.8 153.8,56.5 Q160.8,49.2 160.8,41.0 Q160.8,34.0 154.1,29.7 Q147.4,25.4 134.0,25.4 Q122.0,25.4 109.8,28.8 Q97.6,32.2 87.4,38.4 Q77.2,44.6 71.0,52.6 Q64.8,60.6 64.8,70.0 Q64.8,76.8 68.8,81.0 Q72.8,85.2 79.0,87.7 Q85.2,90.2 91.9,91.7 Q98.6,93.2 104.2,95.0 Q106.2,95.6 106.8,96.6 Q107.4,97.6 107.4,98.6 Q107.4,101.2 104.5,103.0 Q101.6,104.8 96.4,104.8 Q93.2,104.8 89.3,104.7 Q85.4,104.6 81.0,104.6 Q74.8,104.6 67.9,105.2 Q61.0,105.8 52.8,108.4 Q42.4,111.6 34.7,118.4 Q27.0,125.2 22.8,133.4 Q18.6,141.6 18.6,149.6 Q18.6,160.0 23.4,168.4 Q28.2,176.8 38.6,181.7 Q49.0,186.6 66.0,186.6 Q81.6,186.6 96.2,182.6 Q110.8,178.6 123.2,172.3 Q135.6,166.0 144.4,159.2 Q151.6,153.4 156.1,147.4 Q160.6,141.4 160.6,137.0 Q160.6,131.4 152.8,130.2 Q150.8,130.0 150.8,129.0 Q150.8,127.4 153.6,127.4 Q159.4,127.4 163.9,131.3 Q168.4,135.2 168.4,141.0 Q168.4,152.4 152.2,165.0 Q142.4,172.8 128.3,178.8 Q114.2,184.8 97.9,188.3 Q81.6,191.8 65.2,191.8 Z",
    dur: 1.20,
  },
  {
    id: "ld",
    d: "M221.4,180.0 Q214.6,180.0 211.4,175.4 Q208.2,170.8 208.2,164.6 Q208.2,162.8 208.4,160.9 Q208.6,159.0 209.2,157.0 Q206.4,161.4 202.7,166.7 Q199.0,172.0 194.3,175.9 Q189.6,179.8 183.8,179.8 Q181.2,179.8 177.9,178.6 Q174.6,177.4 172.1,174.0 Q169.6,170.6 169.6,164.0 Q169.6,155.4 173.4,145.8 Q177.2,136.2 183.8,127.7 Q190.4,119.2 198.8,113.9 Q207.2,108.6 216.2,108.6 Q223.4,108.6 229.8,112.4 Q232.8,106.8 236.2,99.9 Q239.6,93.0 243.0,86.2 Q246.4,79.4 249.0,73.7 Q251.6,68.0 253.0,65.0 Q256.0,58.0 258.7,56.1 Q261.4,54.2 265.2,54.2 Q267.4,54.2 270.1,54.7 Q272.8,55.2 275.4,55.0 Q274.4,56.0 270.8,61.6 Q267.2,67.2 262.0,76.1 Q256.8,85.0 250.9,95.6 Q245.0,106.2 239.3,117.3 Q233.6,128.4 228.8,138.6 Q224.0,148.8 221.2,156.6 Q218.4,164.4 218.4,168.4 Q218.4,171.0 219.6,172.9 Q220.8,174.8 223.6,174.8 Q227.4,174.8 231.4,171.0 Q235.4,167.2 239.1,161.5 Q242.8,155.8 245.7,150.3 Q248.6,144.8 250.0,141.4 Q252.4,141.4 252.4,143.2 Q250.6,147.4 247.6,153.6 Q244.6,159.8 240.6,165.8 Q236.6,171.8 231.7,175.9 Q226.8,180.0 221.4,180.0 Z M185.2,174.0 Q188.0,174.0 192.2,170.9 Q196.4,167.8 201.2,161.0 Q206.8,153.0 214.0,141.0 Q221.2,129.0 228.2,115.6 Q226.8,114.4 225.2,113.8 Q223.6,113.2 220.8,113.2 Q216.2,113.2 210.7,117.1 Q205.2,121.0 199.7,127.2 Q194.2,133.4 189.7,140.6 Q185.2,147.8 182.5,154.5 Q179.8,161.2 179.8,166.0 Q179.8,174.0 185.2,174.0 Z",
    dur: 0.95,
  },
  {
    id: "lu",
    d: "M255.8,180.0 Q253.6,180.0 250.5,179.0 Q247.4,178.0 245.1,175.3 Q242.8,172.6 242.8,167.2 Q242.8,162.0 246.2,155.2 Q249.6,148.4 252.2,143.2 Q250.0,143.2 250.0,141.4 Q250.2,140.8 251.8,137.6 Q253.4,134.4 255.6,130.0 Q257.8,125.6 259.9,121.5 Q262.0,117.4 263.2,115.2 Q265.6,110.8 270.8,110.8 L283.2,110.8 Q279.8,113.4 277.1,116.5 Q274.4,119.6 270.4,127.8 Q269.0,130.6 267.6,133.4 Q265.5,137.7 263.4,142.0 Q261.3,146.4 259.2,150.8 Q257.8,153.8 255.2,159.4 Q254.4,162.7 253.6,166.0 Q253.6,168.8 253.6,168.8 Q253.6,175.4 258.0,175.4 Q262.8,175.4 269.6,167.6 Q275.2,161.0 280.6,151.8 Q286.0,142.6 290.9,132.8 Q295.8,123.0 299.6,115.2 Q301.8,110.8 307.4,110.8 L318.4,110.8 Q314.0,114.4 309.5,121.6 Q305.0,128.8 299.6,140.0 Q298.2,143.0 296.0,147.6 Q293.8,152.2 292.1,157.4 Q290.4,162.6 290.4,167.8 Q290.4,174.8 295.4,174.8 Q302.2,174.8 308.6,165.4 Q315.0,156.0 321.2,141.4 Q322.8,141.4 323.6,143.2 Q321.4,148.6 318.3,154.9 Q315.2,161.2 311.3,167.0 Q307.4,172.8 302.7,176.4 Q298.0,180.0 292.4,180.0 Q287.4,180.0 284.2,176.3 Q281.0,172.6 281.0,165.8 Q281.0,160.4 283.0,154.2 Q279.6,160.2 275.2,166.2 Q270.8,172.2 265.8,176.1 Q260.8,180.0 255.8,180.0 Z",
    dur: 0.80,
  },
  {
    id: "lJ",
    d: "M364.8,256.4 Q345.8,256.4 330.5,250.0 Q315.2,243.6 306.3,231.4 Q297.4,219.2 297.4,202.0 Q297.4,186.0 303.6,175.7 Q309.8,165.4 317.2,160.2 Q321.4,157.2 325.0,155.9 Q328.6,154.6 329.8,154.6 Q331.0,154.6 331.0,155.6 Q331.0,156.6 330.0,157.2 Q319.6,163.4 314.1,174.8 Q308.6,186.2 308.6,199.8 Q308.6,215.4 315.8,226.9 Q323.0,238.4 335.8,244.6 Q348.6,250.8 365.4,250.8 Q393.8,250.8 419.6,228.4 Q445.4,206.0 469.4,166.0 Q478.4,150.6 486.4,134.2 Q494.4,117.8 501.6,101.8 Q508.8,86.2 515.3,73.7 Q521.8,61.2 526.7,52.6 Q531.6,44.0 533.8,40.6 Q483.2,47.4 455.5,62.2 Q427.8,77.0 427.8,100.2 Q427.8,112.2 434.0,118.1 Q440.2,124.0 448.2,124.0 Q456.0,124.0 463.9,119.0 Q471.8,114.0 477.1,105.1 Q482.4,96.2 482.4,84.4 Q482.4,78.6 478.8,75.0 Q478.8,73.0 480.8,73.0 Q483.2,73.0 485.1,76.6 Q487.0,80.2 487.0,85.6 Q487.0,99.0 480.7,108.7 Q474.4,118.4 464.7,123.6 Q455.0,128.8 444.8,128.8 Q437.0,128.8 430.0,125.4 Q423.0,122.0 418.5,115.0 Q414.0,108.0 414.0,97.6 Q414.0,84.0 423.1,73.9 Q432.2,63.8 448.7,56.6 Q465.2,49.4 487.7,44.2 Q510.2,39.0 537.2,35.2 Q542.8,27.4 547.5,23.0 Q552.2,18.6 557.8,18.6 Q561.0,18.6 562.9,20.2 Q564.8,21.8 564.8,25.0 Q564.8,29.6 561.0,32.5 Q557.2,35.4 551.4,37.1 Q545.6,38.8 539.8,39.8 Q532.4,52.6 526.9,66.1 Q521.4,79.6 516.7,93.7 Q512.0,107.8 506.7,122.5 Q501.4,137.2 494.2,152.6 Q479.2,184.4 459.6,207.7 Q440.0,231.0 416.2,243.7 Q392.4,256.4 364.8,256.4 Z M543.4,34.8 Q551.6,33.4 554.4,31.3 Q557.2,29.2 557.2,27.4 Q557.2,25.0 554.8,25.0 Q552.6,25.0 549.5,28.3 Q546.4,31.6 543.4,34.8 Z",
    dur: 0.90,
  },
  {
    id: "la",
    d: "M559.0,180.6 Q554.4,180.6 550.9,178.0 Q547.4,175.4 547.4,167.4 Q547.4,164.0 547.9,161.0 Q548.4,158.0 549.2,154.6 Q547.4,157.6 544.2,162.0 Q541.0,166.4 537.1,170.6 Q533.2,174.8 529.1,177.6 Q525.0,180.4 521.4,180.4 Q516.2,180.4 513.0,175.7 Q509.8,171.0 509.8,163.4 Q509.8,155.2 513.6,145.8 Q517.4,136.4 524.0,127.8 Q530.6,119.2 539.2,113.8 Q547.8,108.4 557.2,108.4 Q561.8,108.4 566.0,109.9 Q570.2,111.4 573.4,114.8 Q574.8,116.2 574.8,118.0 Q574.8,119.2 573.8,120.0 Q572.8,120.8 571.2,120.4 Q569.0,113.4 561.8,113.4 Q558.4,113.4 554.0,115.6 Q548.6,118.4 542.5,124.5 Q536.4,130.6 531.1,138.3 Q525.8,146.0 522.4,153.8 Q519.0,161.6 519.0,168.0 Q519.0,174.6 524.0,174.6 Q528.4,174.6 533.1,170.4 Q537.8,166.2 542.1,159.9 Q546.4,153.6 550.0,147.4 Q553.6,141.2 555.6,137.4 Q558.6,132.0 561.2,128.4 Q563.8,124.8 568.6,124.8 Q570.8,124.8 573.0,125.4 Q575.2,126.0 577.6,125.6 Q571.6,131.6 567.1,139.8 Q562.6,148.0 560.2,155.9 Q557.8,163.8 557.8,169.2 Q557.8,175.2 561.8,175.2 Q565.0,175.2 568.7,171.6 Q572.4,168.0 575.9,162.5 Q579.4,157.0 582.4,151.3 Q585.4,145.6 587.2,141.4 Q588.9,141.6 589.6,143.2 Q588.9,144.9 587.4,148.0 Q585.8,151.2 583.0,156.6 Q580.2,162.0 576.4,167.5 Q572.6,173.0 568.2,176.8 Q563.8,180.6 559.0,180.6 Z",
    dur: 0.80,
  },
  {
    id: "ly",
    d: "M559.6,243.8 Q549.2,243.8 544.8,239.7 Q540.4,235.6 540.4,230.0 Q540.4,221.4 546.7,214.1 Q553.0,206.8 562.2,202.4 Q572.6,197.6 585.9,194.6 Q599.2,191.6 611.4,188.0 Q615.2,181.4 618.4,172.9 Q621.6,164.4 624.2,156.3 Q626.8,148.2 628.4,143.0 Q626.0,147.4 622.3,153.7 Q618.6,160.0 614.0,166.0 Q609.4,172.0 604.1,176.0 Q598.8,180.0 593.0,180.0 Q590.8,180.0 587.7,179.0 Q584.6,178.0 582.3,175.3 Q580.0,172.6 580.0,167.2 Q580.0,162.0 583.2,155.7 Q586.4,149.4 589.6,143.2 Q587.9,143.0 587.2,141.4 Q589.6,136.2 591.4,132.2 Q593.7,127.4 596.0,122.6 Q597.8,119.0 600.0,114.4 Q602.7,112.6 605.4,110.8 L620.4,110.8 Q619.0,112.0 616.9,113.5 Q614.8,115.0 613.0,118.0 Q607.6,127.2 603.6,135.7 Q599.6,144.2 595.0,153.8 Q592.8,158.4 591.8,162.2 Q590.8,166.0 590.8,168.8 Q590.8,175.4 595.2,175.4 Q600.0,175.4 606.8,167.6 Q612.4,161.0 618.1,151.9 Q623.8,142.8 629.1,133.1 Q634.4,123.4 638.4,115.2 Q640.6,110.8 646.2,110.8 L657.2,110.8 Q651.4,114.8 648.3,121.2 Q645.2,127.6 641.4,137.6 Q637.2,148.6 633.4,160.4 Q629.6,172.2 625.0,184.6 Q634.8,181.2 641.4,175.8 Q648.0,170.4 653.1,161.9 Q658.2,153.4 663.4,141.4 Q665.8,143.2 661.4,152.4 Q657.8,159.4 654.2,166.4 Q649.8,171.7 645.4,177.0 Q638.8,181.5 632.2,186.0 Q621.8,190.2 617.0,198.8 Q610.9,208.1 604.8,217.4 Q597.1,225.5 589.4,233.6 Q580.1,238.7 570.8,243.8 Q559.6,243.8 559.6,243.8 Z M554.8,239.8 Q561.4,239.8 568.4,235.8 Q575.4,231.8 582.0,225.7 Q588.6,219.6 594.1,213.3 Q599.6,207.0 603.0,202.2 Q605.2,198.6 607.6,194.4 Q597.8,197.0 586.1,200.1 Q574.4,203.2 565.8,207.0 Q556.2,211.0 550.7,218.4 Q545.2,225.8 545.2,231.6 Q545.2,235.2 547.5,237.5 Q549.8,239.8 554.8,239.8 Z",
    dur: 1.00,
  },
  {
    id: "lfl",
    d: "M8,200 Q80,190 200,191 Q380,192 560,190 Q630,188 668,179 Q686,173 687,163",
    dur: 0.55,
    strokeWidth: 1.2,
    opacity: 0.42,
  },
];

const STROKE_GAP_MS = 40;

// ─── AURORA MASSES ────────────────────────────────────────────────────────────
// ─── SIGNATURE REVEAL ─────────────────────────────────────────────────────────
interface SignatureRevealProps {
  onComplete: () => void;
}

function SignatureReveal({ onComplete }: SignatureRevealProps): React.ReactElement {
  const [showTagline, setShowTagline] = useState<boolean>(false);
  const [faded, setFaded]             = useState<boolean>(false);

  const penEl   = useRef<SVGGElement>(null);
  const pathEls = useRef<(SVGPathElement | null)[]>([]);
  const raf     = useRef<number | null>(null);
  const started = useRef<boolean>(false);

  useEffect(() => {
    if (started.current) return;
    const boot = setTimeout(() => {
      if (started.current) return;
      started.current = true;

      const lengths: number[] = pathEls.current.map((el) => {
        if (!el) return 1000;
        try {
          const len = el.getTotalLength();
          el.style.strokeDasharray  = String(len);
          el.style.strokeDashoffset = String(len);
          return len;
        } catch { return 1000; }
      });

      let idx = 0;
      let t0: number | null = null;

      const ease = (t: number): number =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const frame = (ts: number): void => {
        if (idx >= SIG_PATHS.length) {
          if (penEl.current) penEl.current.style.opacity = "0";
          setTimeout(() => setShowTagline(true), 220);
          setTimeout(() => {
            setFaded(true);
            setTimeout(onComplete, 500);
          }, 1300);
          return;
        }
        if (t0 === null) t0 = ts;
        const dur   = SIG_PATHS[idx].dur * 1000;
        const raw   = Math.min((ts - t0) / dur, 1);
        const eased = ease(raw);
        const el    = pathEls.current[idx];
        const len   = lengths[idx];
        if (el) el.style.strokeDashoffset = String(len * (1 - eased));
        if (el && penEl.current) {
          try {
            const pt = el.getPointAtLength(eased * len);
            penEl.current.style.transform = `translate3d(${pt.x}px,${pt.y}px,0)`;
            penEl.current.style.opacity   = "1";
          } catch { /* not yet in layout */ }
        }
        if (raw < 1) {
          raf.current = requestAnimationFrame(frame);
        } else {
          if (el) el.style.strokeDashoffset = "0";
          idx++;
          t0 = null;
          setTimeout(() => { raf.current = requestAnimationFrame(frame); }, STROKE_GAP_MS);
        }
      };
      raf.current = requestAnimationFrame(frame);
    }, 150);

    return () => {
      clearTimeout(boot);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [onComplete]);

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 620 }}>
      {/* Eyebrow — Clash Display */}
      <p style={{
        fontFamily:    "'Clash Display', sans-serif",
        fontSize:      "11px",
        fontWeight:    600,
        letterSpacing: "0.20em",
        textTransform: "uppercase",
        color:         "rgba(139,127,245,0.4)",
        marginBottom:  12,
        opacity:       faded ? 0 : 1,
        transition:    "opacity 0.8s ease",
      }}>
        Built in Ghana, for Ghana
      </p>

      <div style={{
        opacity:    faded ? 0.07 : 1,
        transform:  faded ? "translateY(-6px)" : "translateY(0)",
        transition: "opacity 1.6s cubic-bezier(0.25,1,0.5,1), transform 1.6s cubic-bezier(0.25,1,0.5,1)",
        willChange: "opacity, transform",
      }}>
        <div style={{
          position: "absolute", inset: -80,
          background: "radial-gradient(ellipse 70% 55% at 48% 50%, rgba(91,79,233,0.16) 0%, rgba(139,127,245,0.05) 55%, transparent 78%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        <svg viewBox="0 0 700 270" width="100%" style={{ position: "relative", zIndex: 1, overflow: "visible" }}>
          <defs>
            <filter id="sig-ink-glow" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2"   result="b1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" result="b2" />
              <feMerge><feMergeNode in="b1" /><feMergeNode in="b2" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="sig-tip-glow" x="-400%" y="-400%" width="900%" height="900%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5"   result="outer" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="inner" />
              <feMerge><feMergeNode in="outer" /><feMergeNode in="inner" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <style>{`
              @keyframes sig-breathe { 0%,100%{opacity:1} 50%{opacity:0.68} }
              .sig-done { animation: sig-breathe 4s ease-in-out infinite; }
            `}</style>
          </defs>

          {SIG_PATHS.map((s) => (
            <path key={`ghost-${s.id}`} d={s.d} fill="none"
              stroke="rgba(139,127,245,0.05)" strokeWidth={s.strokeWidth ?? 1.8}
              strokeLinecap="round" strokeLinejoin="round" fillRule="evenodd" />
          ))}

          {SIG_PATHS.map((s, i) => (
            <path key={`ink-${s.id}`} ref={(el) => { pathEls.current[i] = el; }}
              d={s.d} fill="none" stroke="#a89cf7" strokeWidth={s.strokeWidth ?? 1.8}
              strokeLinecap="round" strokeLinejoin="round" fillRule="evenodd"
              opacity={s.opacity ?? 1} filter="url(#sig-ink-glow)"
              style={{ willChange: "stroke-dashoffset", strokeDasharray: "9999", strokeDashoffset: "9999" }} />
          ))}

          <g ref={penEl} style={{ opacity: 0, willChange: "transform, opacity", transition: "opacity 0.12s ease" }}
            filter="url(#sig-tip-glow)">
            <circle cx="0" cy="0" r="10"  fill="rgba(139,127,245,0.10)" />
            <circle cx="0" cy="0" r="4.5" fill="rgba(180,168,255,0.28)" />
            <circle cx="0" cy="0" r="2"   fill="rgba(255,255,255,0.97)" />
          </g>

          {/* SVG tagline — Clash Display */}
          <text x="350" y="262" textAnchor="middle" fill="rgba(139,127,245,0.38)"
            style={{
              fontFamily:    "'Clash Display', sans-serif",
              fontSize:      "11px",
              fontWeight:    500,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              opacity:       showTagline ? 1 : 0,
              transform:     showTagline ? "translateY(0)" : "translateY(5px)",
              transition:    "opacity 1s ease 0.1s, transform 1s ease 0.1s",
            }}>
            school management, simplified
          </text>
        </svg>
      </div>
    </div>
  );
}

// ─── EARLY ACCESS LINE ────────────────────────────────────────────────────────
function EarlyAccessLine({ visible }: { visible: boolean }): React.ReactElement {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, marginTop: 24,
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(10px)",
      transition: "opacity 0.9s ease, transform 0.9s ease",
    }}>
      <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8, flexShrink: 0 }}>
        <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#4ade80", animation: "ea-ping 1.8s ease-out infinite", opacity: 0.5 }} />
        <span style={{ position: "relative", display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} />
      </span>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.48)", letterSpacing: "0.01em" }}>
        Now accepting pilot schools
      </span>
    </div>
  );
}

// ─── HERO SECTION ─────────────────────────────────────────────────────────────
export default function HeroSection(): React.ReactElement {
  const [mounted,            setMounted]            = useState<boolean>(false);
  const [earlyAccessVisible, setEarlyAccessVisible] = useState<boolean>(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleSigComplete = (): void => setEarlyAccessVisible(true);

  return (
    <>
      <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

        @keyframes slideUp  { from{opacity:0;transform:translateY(26px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn  { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        @keyframes lineGrow { from{transform:scaleX(0);transform-origin:left} to{transform:scaleX(1);transform-origin:left} }
        @keyframes ea-ping  { 0%{transform:scale(1);opacity:0.5} 100%{transform:scale(2.4);opacity:0} }

        .ej-hero *, .ej-hero *::before, .ej-hero *::after { box-sizing: border-box; }
        .ej-hero a { text-decoration: none; }

        .ej-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 30px;
          background: linear-gradient(135deg, #5B4FE9 0%, #7C71F0 100%);
          color: #fff; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 15px;
          border-radius: 12px; border: none; cursor: pointer;
          box-shadow: 0 4px 24px rgba(91,79,233,0.42);
          transition: box-shadow 0.3s ease, transform 0.2s ease; white-space: nowrap;
        }
        .ej-btn-primary:hover  { box-shadow: 0 8px 32px rgba(91,79,233,0.58); transform: translateY(-2px); }
        .ej-btn-primary:active { transform: translateY(0); }

        .ej-btn-text {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 14px 4px; background: none; border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-weight: 500; font-size: 14px;
          color: rgba(255,255,255,0.38); transition: color 0.2s ease;
          white-space: nowrap; text-decoration: none;
        }
        .ej-btn-text:hover { color: rgba(255,255,255,0.72); }
        .ej-btn-text svg   { transition: transform 0.2s ease; }
        .ej-btn-text:hover svg { transform: translateX(3px); }

        @media (max-width: 1023px) {
          .ej-sig-col  { display: none !important; }
          .ej-grid     { grid-template-columns: 1fr !important; min-height: 100svh !important;
                         padding-left: clamp(24px,6vw,56px) !important;
                         padding-right: clamp(24px,6vw,56px) !important; }
          .ej-copy-col { max-width: 600px !important;
                         padding-top: clamp(96px,16vh,130px) !important;
                         padding-bottom: clamp(56px,8vh,80px) !important; }
          .ej-headline { font-size: clamp(2.8rem,7vw,4.4rem) !important; }
        }
        @media (max-width: 767px) {
          .ej-headline { font-size: clamp(2.4rem,9vw,3.4rem) !important; }
          .ej-sub      { font-size: 1rem !important; }
        }
        @media (max-width: 480px) {
          .ej-grid     { padding-left: 20px !important; padding-right: 20px !important; }
          .ej-copy-col { padding-top: 88px !important; padding-bottom: 48px !important; }
          .ej-headline { font-size: clamp(2rem,10.5vw,2.8rem) !important; line-height: 1.08 !important; }
          .ej-btns     { flex-direction: column !important; align-items: flex-start !important; }
        }
      `}</style>

      <section
        className="ej-hero"
        style={{
          position: "relative",
          width: "100vw",        /* full viewport width — edge to edge */
          minHeight: "100svh",
          background: "#080B18",
          overflow: "hidden",
          isolation: "isolate",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            background:
              "radial-gradient(ellipse 72% 80% at 22% 42%, rgba(32,44,92,0.6) 0%, rgba(16,19,28,0.76) 52%, #10131C 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Top accent line */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "2px", zIndex: 10,
          background: "linear-gradient(90deg, transparent 0%, #5B4FE9 25%, #8B7FF5 60%, transparent 100%)",
          animation: mounted ? "lineGrow 1s ease 0.1s both" : "none",
          transformOrigin: "left",
        }} />

        {/*
          Grid: width 100%, NO maxWidth — hero goes fully wide.
          Padding scales with viewport so content never hugs the edges.
        */}
        <div
          className="ej-grid"
          style={{
            position: "relative", zIndex: 5,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            minHeight: "100svh",
            width: "100%",
            padding: "0 clamp(32px, 6vw, 96px)",
            gap: "clamp(32px, 4vw, 64px)",
            alignItems: "center",
          }}
        >
          {/* ── LEFT — COPY ── */}
          <div
            className="ej-copy-col"
            style={{ paddingTop: "clamp(80px,14vh,120px)", paddingBottom: "clamp(60px,8vh,80px)" }}
          >
            <div style={{ marginBottom: "clamp(24px,3.5vh,36px)" }} />

            {/* Headline — Clash Display, fontWeight 600 */}
            <h1
              className="ej-headline"
              style={{
                fontFamily: "'Clash Display', sans-serif",
                fontWeight: 600,
                fontSize: "clamp(2.8rem,4.8vw,5.6rem)",
                lineHeight: 1.06,
                color: "#fff",
                letterSpacing: "-0.025em",
                margin: "0 0 clamp(16px,2.5vh,22px)",
                animation: mounted ? "slideUp 0.8s cubic-bezier(.22,1,.36,1) 0.3s both" : "none",
                opacity: 0,
              }}
            >
              GHANA&apos;S SCHOOLS DESERVE{" "}
              <span style={{
                background: "linear-gradient(135deg, #8B7FF5 0%, #a78bfa 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                BETTER TOOLS.
              </span>
            </h1>

            <p
              className="ej-sub"
              style={{
                fontFamily: "'DM Sans', sans-serif", fontWeight: 400,
                fontSize: "clamp(1rem,1.35vw,1.1rem)", color: "rgba(255,255,255,0.50)",
                lineHeight: 1.78, maxWidth: 440,
                margin: "0 0 clamp(32px,4.5vh,44px)",
                animation: mounted ? "slideUp 0.75s ease 0.45s both" : "none",
                opacity: 0,
              }}
            >
              One platform. Every part of your school, finally connected.
            </p>

            <div
              className="ej-btns"
              style={{
                display: "flex", alignItems: "center", gap: 24,
                animation: mounted ? "slideUp 0.7s ease 0.58s both" : "none",
                opacity: 0,
              }}
            >
              <a href="/waitlist" className="ej-btn-primary">
                Join the Waitlist
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a href="#demo" className="ej-btn-text">
                Book a demo
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </div>

          {/* ── RIGHT — SIGNATURE ── */}
          <div
            className="ej-sig-col"
            style={{
              display: "flex", flexDirection: "column", justifyContent: "center",
              width: "100%", height: "100%",
              padding: "40px clamp(16px,3vw,40px)",
              animation: mounted ? "scaleIn 0.9s cubic-bezier(.22,1,.36,1) 0.4s both" : "none",
              opacity: 0,
            }}
          >
            <SignatureReveal onComplete={handleSigComplete} />
            <EarlyAccessLine visible={earlyAccessVisible} />
          </div>
        </div>
      </section>
    </>
  );
}
