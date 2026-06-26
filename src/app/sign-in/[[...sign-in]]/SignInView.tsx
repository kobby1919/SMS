"use client";

import dynamic from "next/dynamic";
import { ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AUTH_CALLBACK_PATH, MISSING_ROLE_QUERY } from "@/src/lib/auth/constants";

const ClerkSignIn = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignIn),
  {
    ssr: false,
    loading: () => (
      <div className="w-full rounded-lg border border-slate-200 bg-white p-7 shadow-sm">
        <div className="space-y-4">
          <div className="h-11 rounded-md bg-slate-100" />
          <div className="h-11 rounded-md bg-slate-100" />
          <div className="h-11 rounded-md bg-blue-100" />
        </div>
      </div>
    ),
  },
);

export default function SignInView() {
  const searchParams = useSearchParams();
  const missingRole = searchParams.get("error") === MISSING_ROLE_QUERY;
  const invalidInvite = searchParams.get("error") === "invalid_invite";
  const inviteToken = searchParams.get("invite");
  const callbackUrl = inviteToken
    ? `${AUTH_CALLBACK_PATH}?invite=${encodeURIComponent(inviteToken)}`
    : AUTH_CALLBACK_PATH;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-4 py-10">
      <section className="w-full max-w-[430px]">
        <div className="mb-5 text-center">
          <h1 className="text-2xl font-black tracking-tight text-slate-950">
            Edujay
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Secure school access
          </p>
        </div>

        {missingRole && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Account is missing a role</p>
            <p className="mt-1 text-amber-800/90">
              In Clerk, open the user account and set public metadata:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-white/80 px-3 py-2 font-mono text-xs text-slate-800">
              {`{ "role": "admin", "schoolId": "default-school" }`}
            </pre>
            <p className="mt-2 text-xs text-amber-800/80">
              Sign out, save metadata, then sign in again.
            </p>
          </div>
        )}

        {invalidInvite && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <p className="font-semibold">Invitation could not be accepted</p>
            <p className="mt-1 text-rose-800/90">
              The invite may be expired, already used, or linked to a different email address.
            </p>
          </div>
        )}

        <ClerkSignIn
          forceRedirectUrl={callbackUrl}
          fallbackRedirectUrl={callbackUrl}
          signUpFallbackRedirectUrl={callbackUrl}
          routing="path"
          path="/sign-in"
          appearance={{
            layout: {
              logoPlacement: "none",
              showOptionalFields: false,
            },
            elements: {
              rootBox: "w-full",
              card: "w-full rounded-lg border border-slate-200 shadow-sm",
              cardBox: "shadow-none",
              header: "hidden",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              formFieldLabel: "text-xs font-bold uppercase text-slate-500",
              formFieldInput:
                "rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-900 " +
                "placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-blue-500 " +
                "focus:bg-white focus:ring-2 focus:ring-blue-100",
              formFieldInputShowPasswordButton: "text-slate-400 hover:text-slate-600",
              formButtonPrimary:
                "w-full rounded-md bg-blue-700 py-3 text-sm font-bold text-white transition-colors " +
                "duration-200 hover:bg-blue-800 normal-case",
              footerActionLink: "font-semibold text-blue-700 hover:text-blue-900",
              footerActionText: "text-sm text-slate-500",
              dividerLine: "bg-slate-100",
              dividerText: "text-xs text-slate-400",
              formFieldErrorText: "text-xs font-medium text-rose-500",
              alertText: "text-sm font-medium text-rose-600",
              socialButtonsBlockButton:
                "rounded-md border border-slate-200 transition-colors hover:bg-slate-50",
              footer: "hidden",
              footerAction: "hidden",
              footerPages: "hidden",
            },
            variables: {
              colorPrimary: "#1d4ed8",
              colorText: "#0f172a",
              colorTextSecondary: "#64748b",
              colorBackground: "#ffffff",
              colorInputBackground: "#f8fafc",
              colorInputText: "#0f172a",
              borderRadius: "0.5rem",
              fontFamily: "var(--font-inter)",
            },
          }}
        />

        <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
          <ShieldCheck size={14} className="text-emerald-600" />
          <span>Protected by Clerk</span>
        </div>
      </section>
    </main>
  );
}
