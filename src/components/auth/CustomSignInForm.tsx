"use client";

import { useState, type FormEvent } from "react";
import { useSignIn } from "@clerk/nextjs";
import SocialAuthButtons, { type SocialAuthStrategy } from "./SocialAuthButtons";

type CustomSignInFormProps = {
  callbackUrl: string;
  initialEmail?: string;
};

type SignInMode = "password" | "mfa" | "reset-code" | "reset-password";
type MfaStrategy = "email_code" | "phone_code" | "totp" | "backup_code";

type MfaChallenge = {
  strategy: MfaStrategy;
  label: string;
  deliveryId?: string;
  canResend: boolean;
};

function getClerkError(error: unknown, fallback = "Sign in failed. Please try again.") {
  if (typeof error === "object" && error && "errors" in error) {
    const clerkError = error as { errors?: Array<{ longMessage?: string; message?: string }> };
    return clerkError.errors?.[0]?.longMessage ?? clerkError.errors?.[0]?.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function isLikelyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function CustomSignInForm({ callbackUrl, initialEmail = "" }: CustomSignInFormProps) {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState(initialEmail.trim().toLowerCase());
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [mode, setMode] = useState<SignInMode>("password");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailLocked = Boolean(initialEmail);
  const identifier = email.trim();
  const normalizedEmail = identifier.toLowerCase();
  const isEmailIdentifier = isLikelyEmail(normalizedEmail);

  function clearMessages() {
    setError(null);
    setNotice(null);
  }

  function returnToPasswordMode(message?: string) {
    setMode("password");
    setPassword("");
    setMfaCode("");
    setMfaChallenge(null);
    setResetCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setError(null);
    setNotice(message ?? null);
  }

  async function activateSession(sessionId: string) {
    if (!setActive) return;
    await setActive({ session: sessionId });
    window.location.assign(callbackUrl);
  }

  async function startMfaChallenge() {
    if (!signIn) return false;

    const factors = signIn.supportedSecondFactors ?? [];
    const emailFactor = factors.find((factor) => factor.strategy === "email_code" && "emailAddressId" in factor);
    const phoneFactor = factors.find((factor) => factor.strategy === "phone_code" && "phoneNumberId" in factor);
    const totpFactor = factors.find((factor) => factor.strategy === "totp");
    const backupFactor = factors.find((factor) => factor.strategy === "backup_code");

    if (emailFactor && "emailAddressId" in emailFactor) {
      await signIn.prepareSecondFactor({ strategy: "email_code", emailAddressId: emailFactor.emailAddressId });
      setMfaChallenge({ strategy: "email_code", deliveryId: emailFactor.emailAddressId, label: "Enter the verification code sent to your email.", canResend: true });
      setMode("mfa");
      setMfaCode("");
      setNotice("We sent a verification code to your email.");
      return true;
    }

    if (phoneFactor && "phoneNumberId" in phoneFactor) {
      await signIn.prepareSecondFactor({ strategy: "phone_code", phoneNumberId: phoneFactor.phoneNumberId });
      setMfaChallenge({ strategy: "phone_code", deliveryId: phoneFactor.phoneNumberId, label: "Enter the verification code sent to your phone.", canResend: true });
      setMode("mfa");
      setMfaCode("");
      setNotice("We sent a verification code to your phone.");
      return true;
    }

    if (totpFactor) {
      setMfaChallenge({ strategy: "totp", label: "Enter the code from your authenticator app.", canResend: false });
      setMode("mfa");
      setMfaCode("");
      setNotice("Enter the code from your authenticator app.");
      return true;
    }

    if (backupFactor) {
      setMfaChallenge({ strategy: "backup_code", label: "Enter one of your backup codes.", canResend: false });
      setMode("mfa");
      setMfaCode("");
      setNotice("Enter one of your backup codes.");
      return true;
    }

    return false;
  }

  async function handleSocialSignIn(strategy: SocialAuthStrategy) {
    if (!isLoaded || !signIn) return;

    clearMessages();
    setIsSubmitting(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: callbackUrl,
      });
    } catch (err) {
      setError(getClerkError(err, "Social sign-in could not start. Please try again."));
      setIsSubmitting(false);
    }
  }

  async function handlePasswordSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded || !signIn || !setActive) return;

    clearMessages();
    setIsSubmitting(true);
    try {
      const result = await signIn.create({ identifier: isEmailIdentifier ? normalizedEmail : identifier, password });
      if (result.status === "complete" && result.createdSessionId) {
        await activateSession(result.createdSessionId);
        return;
      }
      if (result.status === "needs_second_factor") {
        const started = await startMfaChallenge();
        if (!started) {
          setError("This account requires multi-factor verification, but Edujay could not find a supported verification method. Please contact the school admin.");
        }
        return;
      }
      setError("This account needs an extra verification step that is not available on this custom screen yet. Please contact the school admin.");
    } catch (err) {
      setError(getClerkError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendMfaCode() {
    if (!isLoaded || !signIn || !mfaChallenge?.canResend) return;

    clearMessages();
    setIsSubmitting(true);
    try {
      if (mfaChallenge.strategy === "email_code") {
        await signIn.prepareSecondFactor({ strategy: "email_code", emailAddressId: mfaChallenge.deliveryId });
        setNotice("We sent a new verification code to your email.");
      }
      if (mfaChallenge.strategy === "phone_code") {
        await signIn.prepareSecondFactor({ strategy: "phone_code", phoneNumberId: mfaChallenge.deliveryId });
        setNotice("We sent a new verification code to your phone.");
      }
      setMfaCode("");
    } catch (err) {
      setError(getClerkError(err, "Could not resend the verification code. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded || !signIn || !mfaChallenge) return;

    clearMessages();
    setIsSubmitting(true);
    try {
      const code = mfaCode.trim();
      const result = mfaChallenge.strategy === "email_code"
        ? await signIn.attemptSecondFactor({ strategy: "email_code", code })
        : mfaChallenge.strategy === "phone_code"
          ? await signIn.attemptSecondFactor({ strategy: "phone_code", code })
          : mfaChallenge.strategy === "totp"
            ? await signIn.attemptSecondFactor({ strategy: "totp", code })
            : await signIn.attemptSecondFactor({ strategy: "backup_code", code });

      if (result.status === "complete" && result.createdSessionId) {
        await activateSession(result.createdSessionId);
        return;
      }
      setError("Verification could not be completed. Please check the code and try again.");
    } catch (err) {
      setError(getClerkError(err, "Verification failed. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendResetCode() {
    if (!isLoaded || !signIn) return;

    if (!isLikelyEmail(normalizedEmail)) {
      setNotice(null);
      setError("Enter a valid email address before requesting a password reset code.");
      return;
    }

    clearMessages();
    setIsSubmitting(true);
    try {
      const result = await signIn.create({ identifier: normalizedEmail });
      const resetFactor = result.supportedFirstFactors?.find(
        (factor) => factor.strategy === "reset_password_email_code" && "emailAddressId" in factor,
      );

      if (!resetFactor || !("emailAddressId" in resetFactor)) {
        setError("Password reset is not available for this account. Please contact the school admin.");
        return;
      }

      await signIn.prepareFirstFactor({ strategy: "reset_password_email_code", emailAddressId: resetFactor.emailAddressId });
      setResetCode("");
      setMode("reset-code");
      setNotice(`We sent a password reset code to ${normalizedEmail}.`);
    } catch (err) {
      setError(getClerkError(err, "Password reset failed. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyResetCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded || !signIn) return;

    clearMessages();
    setIsSubmitting(true);
    try {
      const result = await signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code: resetCode.trim() });
      if (result.status === "needs_new_password") {
        setNewPassword("");
        setConfirmNewPassword("");
        setMode("reset-password");
        setNotice("Code accepted. Set a new password for this account.");
        return;
      }
      setError("We could not verify that reset code yet. Please check the code and try again.");
    } catch (err) {
      setError(getClerkError(err, "Reset code verification failed. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded || !signIn || !setActive) return;

    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      setNotice(null);
      return;
    }

    clearMessages();
    setIsSubmitting(true);
    try {
      const result = await signIn.resetPassword({ password: newPassword, signOutOfOtherSessions: true });
      if (result.status === "complete") {
        if (result.createdSessionId) {
          await activateSession(result.createdSessionId);
          return;
        }
        returnToPasswordMode("Password reset successfully. Sign in with your new password.");
        return;
      }
      setError("Password reset could not be completed. Please try again.");
    } catch (err) {
      setError(getClerkError(err, "Password reset could not be completed. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (mode === "mfa" && mfaChallenge) {
    return (
      <form onSubmit={handleVerifyMfa} className="space-y-5">
        <AuthMessages notice={notice} error={error} />
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-blue-900">
          {mfaChallenge.label}
        </div>
        <label className="block space-y-2">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Verification code</span>
          <input
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value)}
            placeholder={mfaChallenge.strategy === "backup_code" ? "Backup code" : "123456"}
            required
            autoComplete="one-time-code"
            inputMode={mfaChallenge.strategy === "backup_code" ? "text" : "numeric"}
            className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </label>
        <button
          type="submit"
          disabled={!isLoaded || isSubmitting}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-800 text-base font-black text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isSubmitting ? "Verifying..." : "Verify and continue"}
          <span aria-hidden="true">→</span>
        </button>
        <div className="grid gap-3 sm:grid-cols-2">
          {mfaChallenge.canResend && (
            <button
              type="button"
              onClick={handleResendMfaCode}
              disabled={!isLoaded || isSubmitting}
              className="h-12 rounded-xl border border-slate-200 text-sm font-black text-[#061f5f] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Resend code
            </button>
          )}
          <button
            type="button"
            onClick={() => returnToPasswordMode()}
            disabled={isSubmitting}
            className="h-12 rounded-xl border border-slate-200 text-sm font-black text-[#061f5f] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Back to sign in
          </button>
        </div>
      </form>
    );
  }

  if (mode === "reset-code") {
    return (
      <form onSubmit={handleVerifyResetCode} className="space-y-5">
        <AuthMessages notice={notice} error={error} />
        <label className="block space-y-2">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Reset code</span>
          <input
            value={resetCode}
            onChange={(event) => setResetCode(event.target.value)}
            placeholder="123456"
            required
            autoComplete="one-time-code"
            inputMode="numeric"
            className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </label>
        <button
          type="submit"
          disabled={!isLoaded || isSubmitting}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-800 text-base font-black text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isSubmitting ? "Checking code..." : "Continue"}
          <span aria-hidden="true">→</span>
        </button>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleSendResetCode}
            disabled={!isLoaded || isSubmitting}
            className="h-12 rounded-xl border border-slate-200 text-sm font-black text-[#061f5f] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Resend code
          </button>
          <button
            type="button"
            onClick={() => returnToPasswordMode()}
            disabled={isSubmitting}
            className="h-12 rounded-xl border border-slate-200 text-sm font-black text-[#061f5f] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Back to sign in
          </button>
        </div>
      </form>
    );
  }

  if (mode === "reset-password") {
    return (
      <form onSubmit={handleSubmitNewPassword} className="space-y-5">
        <AuthMessages notice={notice} error={error} />
        <label className="block space-y-2">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">New password</span>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Enter new password"
            required
            autoComplete="new-password"
            className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Confirm new password</span>
          <input
            type="password"
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
            placeholder="Confirm new password"
            required
            autoComplete="new-password"
            className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </label>
        <button
          type="submit"
          disabled={!isLoaded || isSubmitting}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-800 text-base font-black text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isSubmitting ? "Saving password..." : "Save new password"}
          <span aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          onClick={() => returnToPasswordMode()}
          disabled={isSubmitting}
          className="h-12 w-full rounded-xl border border-slate-200 text-sm font-black text-[#061f5f] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handlePasswordSignIn} className="space-y-5">
      <AuthMessages notice={notice} error={error} />

      <label className="block space-y-2">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Email or username</span>
        <input
          type="text"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@school.edu.gh or username"
          disabled={emailLocked || isSubmitting}
          required
          autoComplete="username"
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
          autoComplete="current-password"
          className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSendResetCode}
          disabled={!isLoaded || isSubmitting || !isEmailIdentifier}
          className="text-sm font-black text-[#061f5f] hover:text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          Forgot password?
        </button>
      </div>

      <button
        type="submit"
        disabled={!isLoaded || isSubmitting}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-800 text-base font-black text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
        <span aria-hidden="true">→</span>
      </button>

      <SocialAuthButtons disabled={!isLoaded || isSubmitting} onSelect={handleSocialSignIn} />
    </form>
  );
}

function AuthMessages({ notice, error }: { notice: string | null; error: string | null }) {
  return (
    <>
      {notice && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}
    </>
  );
}

