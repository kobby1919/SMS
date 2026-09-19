"use client";

import { useState, type FormEvent } from "react";
import { useSignUp } from "@clerk/nextjs";
import SocialAuthButtons, { type SocialAuthStrategy } from "./SocialAuthButtons";

type CustomSignUpFormProps = {
  callbackUrl: string;
  initialEmail?: string;
};

function getClerkError(error: unknown) {
  if (typeof error === "object" && error && "errors" in error) {
    const clerkError = error as { errors?: Array<{ longMessage?: string; message?: string }> };
    return clerkError.errors?.[0]?.longMessage ?? clerkError.errors?.[0]?.message ?? "Account creation failed. Please try again.";
  }
  if (error instanceof Error) return error.message;
  return "Account creation failed. Please try again.";
}

export default function CustomSignUpForm({ callbackUrl, initialEmail = "" }: CustomSignUpFormProps) {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [email, setEmail] = useState(initialEmail.trim().toLowerCase());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailLocked = Boolean(initialEmail);

  async function handleSocialSignUp(strategy: SocialAuthStrategy) {
    if (!isLoaded || !signUp) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: callbackUrl,
      });
    } catch (err) {
      setError(getClerkError(err));
      setIsSubmitting(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded || !signUp) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await signUp.create({ emailAddress: email.trim().toLowerCase(), password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setIsVerifying(true);
    } catch (err) {
      setError(getClerkError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded || !signUp || !setActive) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        window.location.assign(callbackUrl);
        return;
      }
      setError("We could not complete verification yet. Please check the code and try again.");
    } catch (err) {
      setError(getClerkError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isVerifying) {
    return (
      <form onSubmit={handleVerify} className="space-y-5">
        {error && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-blue-900">
          Enter the verification code sent to <span className="font-black">{email}</span>.
        </div>
        <label className="block space-y-2">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Verification code</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            required
            autoComplete="one-time-code"
            className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </label>
        <button
          type="submit"
          disabled={!isLoaded || isSubmitting}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-800 text-base font-black text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isSubmitting ? "Verifying..." : "Verify account"}
          <span aria-hidden="true">→</span>
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCreate} className="space-y-5">
      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      <label className="block space-y-2">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Email address</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@school.edu.gh"
          disabled={emailLocked || isSubmitting}
          required
          autoComplete="email"
          className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          required
          autoComplete="new-password"
          className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Confirm password</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="••••••••"
          required
          autoComplete="new-password"
          className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
      </label>

      <div id="clerk-captcha" />

      <button
        type="submit"
        disabled={!isLoaded || isSubmitting}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-800 text-base font-black text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        {isSubmitting ? "Creating account..." : "Create account"}
        <span aria-hidden="true">→</span>
      </button>

      <SocialAuthButtons disabled={!isLoaded || isSubmitting} onSelect={handleSocialSignUp} />
    </form>
  );
}



