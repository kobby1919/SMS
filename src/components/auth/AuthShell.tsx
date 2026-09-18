"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { BadgeCheck, BookOpenCheck, GraduationCap, ShieldCheck } from "lucide-react";

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
    <main className="min-h-dvh overflow-x-hidden bg-[#f5f7fb] text-slate-950">
      <section className="grid min-h-dvh w-full grid-cols-1 lg:grid-cols-[minmax(360px,42%)_1fr]">
        <aside className="relative hidden min-h-dvh overflow-hidden bg-[#07111f] px-10 py-10 text-white lg:flex xl:px-14">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "url('/school.svg')",
              backgroundRepeat: "repeat",
              backgroundSize: "180px 180px",
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.42),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_32%)]"
          />
          <div className="relative z-10 flex min-h-full w-full flex-col justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-edujay-primary shadow-sm">
                <Image src="/school.svg" alt="Edujay" width={26} height={26} className="h-7 w-7" />
              </div>
              <div>
                <p className="font-nunito text-2xl font-black tracking-tight">Edujay</p>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                  School operations
                </p>
              </div>
            </div>

            <div className="my-16 max-w-xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-200">
                One source of truth
              </p>
              <h1 className="mt-5 font-nunito text-4xl font-black leading-[1.05] tracking-tight xl:text-5xl">
                Modern school access, kept simple and controlled.
              </h1>
              <p className="mt-5 max-w-lg text-base font-semibold leading-8 text-white/62">
                Attendance, academics, fees, communication, and operations stay connected under one trusted Edujay account.
              </p>

              <div className="mt-8 grid gap-3 text-sm font-bold text-white/78">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/7 px-4 py-3 backdrop-blur">
                  <ShieldCheck size={18} className="text-blue-200" />
                  Role-aware access for every school user
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/7 px-4 py-3 backdrop-blur">
                  <BookOpenCheck size={18} className="text-blue-200" />
                  School records linked to the right person
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/7 px-4 py-3 backdrop-blur">
                  <GraduationCap size={18} className="text-blue-200" />
                  Built for admins, teachers, parents, and finance
                </div>
              </div>
            </div>

            <p className="text-xs font-bold leading-6 text-white/42">
              Edujay verifies role, school, and invite context before opening the dashboard.
            </p>
          </div>
        </aside>

        <div className="flex min-h-dvh items-start justify-center px-4 py-6 sm:px-6 lg:items-center lg:px-12">
          <section className="w-full max-w-[460px]">
            <div className="mb-5 lg:hidden">
              <div className="inline-flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-edujay-primary text-white shadow-sm shadow-blue-100">
                  <Image src="/school.svg" alt="Edujay" width={24} height={24} className="h-6 w-6 brightness-0 invert" />
                </div>
                <div>
                  <h1 className="font-nunito text-2xl font-black tracking-tight text-slate-950">
                    Edujay
                  </h1>
                  <p className="text-sm font-bold text-slate-500">{subtitle}</p>
                </div>
              </div>
            </div>

            <div className="mb-5 hidden lg:block">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-edujay-primary">
                {eyebrow}
              </p>
              <h1 className="mt-2 font-nunito text-3xl font-black tracking-tight text-slate-950">
                {title}
              </h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                {helper}
              </p>
            </div>

            <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:hidden">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-edujay-primary">
                {eyebrow}
              </p>
              <h2 className="mt-2 font-nunito text-2xl font-black tracking-tight text-slate-950">
                {title}
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                {helper}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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
          </section>
        </div>
      </section>
    </main>
  );
}
