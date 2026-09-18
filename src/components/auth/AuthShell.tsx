"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { BadgeCheck, ShieldCheck } from "lucide-react";

type AuthShellProps = {
  mode: "sign-in" | "sign-up";
  subtitle: string;
  eyebrow?: string;
  children: ReactNode;
};

export default function AuthShell({
  mode,
  subtitle,
  eyebrow = "Secure school access",
  children,
}: AuthShellProps) {
  const title = mode === "sign-in"
    ? "Good day, continue to Edujay"
    : "Good day, create your Edujay account";
  const helper = mode === "sign-in"
    ? "Sign in with the email connected to your school account."
    : "Use the email from your school invite so Edujay can link your role correctly.";

  return (
    <main className="min-h-dvh overflow-x-hidden bg-white text-slate-950">
      <section className="grid min-h-dvh w-full grid-cols-1 lg:grid-cols-[minmax(340px,38%)_1fr]">
        <aside className="relative hidden min-h-dvh overflow-hidden bg-[#f8fafc] px-10 py-10 lg:flex xl:px-14">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage: "url('/edujay-auth-pattern.svg')",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "top right",
              backgroundSize: "420px 420px",
            }}
          />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white to-transparent" />
          <div className="relative z-10 flex min-h-full w-full flex-col justify-between">
            <BrandLockup subtitle="One source of truth for modern schools" />

            <div className="my-16 max-w-md">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-edujay-primary">
                {eyebrow}
              </p>
              <h1 className="mt-5 font-nunito text-4xl font-black leading-[1.06] tracking-tight text-slate-950 xl:text-5xl">
                School access that stays simple.
              </h1>
              <p className="mt-5 max-w-sm text-base font-semibold leading-8 text-slate-500">
                Edujay keeps each user connected to the right school, role, and records.
              </p>
            </div>

            <p className="max-w-sm text-xs font-bold leading-6 text-slate-400">
              Attendance, academics, fees, communication, and operations under one controlled login.
            </p>
          </div>
        </aside>

        <div
          className="relative flex min-h-dvh items-start justify-center overflow-hidden px-5 py-6 sm:px-6 lg:items-center lg:bg-[#f5f7fb] lg:px-12"
          style={{
            backgroundImage: "url('/edujay-auth-pattern.svg')",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "top right",
            backgroundSize: "min(82vw, 320px)",
          }}
        >
          <div className="absolute inset-0 bg-white/88 lg:hidden" aria-hidden="true" />
          <section className="relative z-10 flex min-h-[calc(100dvh-3rem)] w-full max-w-[460px] flex-col lg:min-h-0">
            <div className="pt-2 lg:hidden">
              <BrandLockup subtitle={subtitle} />
            </div>

            <div className="flex flex-1 flex-col justify-center py-8 lg:block lg:flex-none lg:py-0">
              <div className="mb-7 text-center lg:text-left">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-edujay-primary">
                  {eyebrow}
                </p>
                <h1 className="mt-3 font-nunito text-[1.95rem] font-black leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-3xl">
                  {title}
                </h1>
                <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-6 text-slate-500 lg:mx-0">
                  {helper}
                </p>
              </div>

              <div className="rounded-none border-0 bg-transparent p-0 shadow-none lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white lg:p-5 lg:shadow-sm">
                {children}

                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    Protected by Clerk
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <BadgeCheck size={14} className="text-edujay-primary" />
                    Edujay role verified
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function BrandLockup({ subtitle }: { subtitle: string }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <Image src="/edujay-logo.png" alt="Edujay" width={112} height={76} className="h-14 w-auto sm:h-16 lg:h-20" priority />
      <div>
        <p className="font-nunito text-2xl font-black tracking-tight text-slate-950">Edujay</p>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
          {subtitle}
        </p>
      </div>
    </div>
  );
}


