"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./HeroStill.module.css";
import { useEffect, useState } from "react";

export default function HeroStill() {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const restart = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      if (disposed || document.hidden) return;
      // Paint the hidden starting state before starting the original entrance.
      frame = requestAnimationFrame(() => {
        setEntered(false);
        frame = requestAnimationFrame(() => {
          timer = setTimeout(() => setEntered(true), 60);
        });
      });
    };
    void document.fonts.ready.then(restart);
    document.addEventListener("visibilitychange", restart);
    window.addEventListener("pageshow", restart);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", restart);
      window.removeEventListener("pageshow", restart);
    };
  }, []);
  return (
    <section className={styles.hero} aria-labelledby="homepage-heading">
      <div className={styles.stage} data-entered={entered}>
        <div className={styles.artwork} aria-hidden="true">
          <Image src="/edujay-school-work-approved.png" alt="" fill sizes="100vw" priority className={styles.background} />
        </div>
        <div className={styles.copy}>
          <h1 id="homepage-heading" className={styles.heading}>
            School management,<br /><span>in one place.</span>
          </h1>
          <p className={styles.description}>
            One platform. Every part of your school, finally connected.
          </p>
          <div className={styles.actions}>
            <Link href="/request-access" className={styles.primary}>Request School Access <ArrowRight size={17} aria-hidden="true" /></Link>
            <Link href="/features" className={styles.secondary}>Explore Features <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
          <p className={styles.attribution}>A product of MiqraTech Consult</p>
        </div>
      </div>
    </section>
  );
}
