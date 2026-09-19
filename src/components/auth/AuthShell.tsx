"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import EdujayBrandLogo from "@/src/components/EdujayBrandLogo";

type AuthShellProps = {
  mode: "sign-in" | "sign-up";
  eyebrow?: string;
  alternateHref?: string;
  children: ReactNode;
};

const DEFAULT_EYEBROW = "Secure school access";

export default function AuthShell({
  mode,
  eyebrow = DEFAULT_EYEBROW,
  alternateHref,
  children,
}: AuthShellProps) {
  const isSignIn = mode === "sign-in";
  const title = isSignIn ? "Welcome back" : "Create account";
  const helper = isSignIn
    ? "Sign in to your school workspace."
    : "Create your account with the email from your school invite.";
  const signInHref = isSignIn ? "/sign-in" : (alternateHref ?? "/sign-in");
  const signUpHref = isSignIn ? (alternateHref ?? "/sign-up") : "/sign-up";

  const showEyebrowBadge = eyebrow !== DEFAULT_EYEBROW;

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-white text-slate-950">
      <AuthBackground />

      <section className="relative z-10 grid min-h-dvh w-full grid-cols-1 lg:grid-cols-2">
        <aside className="hidden min-h-dvh items-center px-10 py-10 text-white lg:flex xl:px-16">
          <div className="max-w-md">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-white/65">
              Edujay school access
            </p>
            <h1 className="mt-5 font-nunito text-4xl font-black leading-[1.05] tracking-tight xl:text-5xl">
              One secure login for every school role.
            </h1>
            <p className="mt-5 max-w-sm text-base font-semibold leading-8 text-white/72">
              Staff, parents, finance teams, and school leaders enter through one controlled gateway.
            </p>
            <div className="mt-8 grid gap-3 text-sm font-bold text-white/70">
              <p>Role-aware access</p>
              <p>Invite-only setup</p>
              <p>Protected school records</p>
            </div>
          </div>
        </aside>

        <div className="flex min-h-dvh items-start justify-center px-5 py-8 sm:px-6 lg:items-center lg:px-10 lg:py-10">
          <div className="flex w-full max-w-[476px] flex-col">
            <div>
              <EdujayBrandLogo size="sm" priority />
            </div>

            <div className="mt-14 sm:mt-16 lg:mt-14">
              {showEyebrowBadge && (
                <span className="mb-4 inline-flex items-center rounded-full bg-edujay-primary/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-edujay-primary">
                  {eyebrow}
                </span>
              )}
              <h1 className="font-nunito text-[2rem] font-black leading-tight tracking-tight text-slate-950 sm:text-[2.25rem]">
                {title}
              </h1>
              <p className="mt-2 text-lg font-medium leading-7 text-slate-500">
                {helper}
              </p>
            </div>

            <div className="mt-7 grid h-[54px] grid-cols-2 rounded-xl bg-slate-100 p-1 text-base font-medium text-slate-600">
              {isSignIn ? (
                <span className="flex items-center justify-center rounded-lg bg-white text-[#061f5f] shadow-sm">
                  Sign in
                </span>
              ) : (
                <Link href={signInHref} className="flex items-center justify-center rounded-lg transition hover:text-[#061f5f]">
                  Sign in
                </Link>
              )}
              {isSignIn ? (
                <Link href={signUpHref} className="flex items-center justify-center rounded-lg transition hover:text-[#061f5f]">
                  Create account
                </Link>
              ) : (
                <span className="flex items-center justify-center rounded-lg bg-white text-[#061f5f] shadow-sm">
                  Create account
                </span>
              )}
            </div>

            <div className="mt-8">{children}</div>

            <p className="mt-8 text-center text-base font-medium text-slate-500">
              {isSignIn ? "Don't have an account?" : "Already have an account?"}{" "}
              <Link href={isSignIn ? signUpHref : signInHref} className="font-black text-[#061f5f] hover:text-blue-800">
                {isSignIn ? "Create one" : "Sign in"}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function AuthBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 hidden bg-cover bg-center bg-no-repeat lg:block"
        style={{ backgroundImage: "url('/edujay-auth-split-desktop.png')" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_58%,_#edf7ff_100%)] lg:hidden" />
    </div>
  );
}

