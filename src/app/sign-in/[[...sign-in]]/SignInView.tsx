"use client";

import dynamic from "next/dynamic";
import { GraduationCap, BookOpen, Users, Shield } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AUTH_CALLBACK_PATH, MISSING_ROLE_QUERY } from "@/src/lib/auth/constants";

const ClerkSignIn = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignIn),
  {
    ssr: false,
    loading: () => (
      <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-8 shadow-xl">
        <div className="mx-auto h-5 w-36 rounded-full bg-gray-100" />
        <div className="mt-8 space-y-4">
          <div className="h-12 rounded-xl bg-gray-100" />
          <div className="h-12 rounded-xl bg-gray-100" />
          <div className="h-12 rounded-xl bg-indigo-100" />
        </div>
      </div>
    ),
  }
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
    <div className="min-h-screen bg-gradient-to-br from-[#f0f4ff] via-white to-[#f5f0ff] flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#C3EBFA]/30 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#CFCEFF]/30 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#FAE27C]/10 blur-3xl" />
      </div>

      <div className="relative w-full flex flex-col items-center">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C3EBFA] to-[#CFCEFF] shadow-lg mb-4">
            <GraduationCap className="text-indigo-700" size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">
            Jayline
          </h1>
          <p className="text-sm text-gray-500 mt-1">Academic</p>
        </div>

        <div className="flex items-center justify-center gap-6 mb-6">
          {[
            { icon: <Users size={13} />, label: "42 Students" },
            { icon: <BookOpen size={13} />, label: "23 Subjects" },
            { icon: <Shield size={13} />, label: "Secure Login" },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500"
            >
              <span className="text-indigo-500">{icon}</span>
              {label}
            </div>
          ))}
        </div>

        {missingRole && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Account is missing a role</p>
            <p className="mt-1 text-amber-800/90">
              In Clerk → Users → your account → Public metadata, set:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-white/80 px-3 py-2 text-xs font-mono text-gray-800">
              {`{ "role": "admin", "schoolId": "default-school" }`}
            </pre>
            <p className="mt-2 text-xs text-amber-800/80">
              Sign out, save metadata, then sign in again.
            </p>
          </div>
        )}

        {invalidInvite && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
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
              card: "shadow-xl border border-gray-100 rounded-3xl",
              cardBox: "shadow-none",
              headerTitle: "text-xl font-black text-gray-800 tracking-tight",
              headerSubtitle: "text-sm text-gray-400 font-medium",
              formFieldLabel:
                "text-xs font-black uppercase tracking-wider text-gray-500",
              formFieldInput:
                "bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 " +
                "placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:bg-white " +
                "focus:ring-2 focus:ring-indigo-100 transition-all duration-200",
              formFieldInputShowPasswordButton:
                "text-gray-400 hover:text-gray-600",
              formButtonPrimary:
                "w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 " +
                "text-white font-bold text-sm rounded-xl py-3 transition-all duration-200 " +
                "shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 normal-case",
              footerActionLink:
                "text-indigo-600 font-semibold hover:text-indigo-800",
              footerActionText: "text-gray-400 text-sm",
              dividerLine: "bg-gray-100",
              dividerText: "text-gray-400 text-xs",
              formFieldErrorText: "text-rose-500 text-xs font-medium",
              alertText: "text-rose-600 text-sm font-medium",
              socialButtonsBlockButton:
                "border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors",
            },
            variables: {
              colorPrimary: "#4f46e5",
              colorText: "#1f2937",
              colorTextSecondary: "#9ca3af",
              colorBackground: "#ffffff",
              colorInputBackground: "#f9fafb",
              colorInputText: "#1f2937",
              borderRadius: "0.75rem",
              fontFamily: "var(--font-inter)",
            },
          }}
        />

        <div className="flex flex-wrap justify-center gap-2 mt-5">
          {[
            { label: "Admin", color: "bg-violet-50 text-violet-600" },
            { label: "Teacher", color: "bg-sky-50 text-sky-600" },
            { label: "Student", color: "bg-emerald-50 text-emerald-600" },
            { label: "Parent", color: "bg-amber-50 text-amber-600" },
          ].map(({ label, color }) => (
            <span
              key={label}
              className={`text-[11px] font-semibold px-3 py-1 rounded-full ${color}`}
            >
              {label}
            </span>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4 font-medium">
          Jayline Academic • Term 2 • 2025/26
        </p>
      </div>
    </div>
  );
}
