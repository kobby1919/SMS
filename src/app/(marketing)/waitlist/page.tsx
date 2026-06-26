// src/app/(marketing)/waitlist/page.tsx
"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { joinWaitlist } from "@/src/lib/actions/waitlistActions";
import type { WaitlistInput, WaitlistResult } from "@/src/lib/actions/waitlistActions";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Field = keyof WaitlistInput;

type FormState = {
  values:      WaitlistInput;
  fieldErrors: Partial<Record<Field, string>>;
  submitted:   boolean;
};

const INITIAL: FormState = {
  values: {
    name:       "",
    schoolName: "",
    email:      "",
    role:       "HEADMASTER",
    message:    "",
  },
  fieldErrors: {},
  submitted:   false,
};

const ROLES: { value: WaitlistInput["role"]; label: string }[] = [
  { value: "HEADMASTER",     label: "Headmaster / Principal" },
  { value: "ADMINISTRATOR",  label: "School Administrator"   },
  { value: "TEACHER",        label: "Teacher"                },
  { value: "OTHER",          label: "Other"                  },
];

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display:       "block",
      fontFamily:    "'DM Sans', sans-serif",
      fontSize:      "13px",
      fontWeight:    500,
      color:         "rgba(255,255,255,0.60)",
      marginBottom:  6,
      letterSpacing: "0.01em",
    }}>
      {children}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p style={{
      fontFamily: "'DM Sans', sans-serif",
      fontSize:   "12px",
      color:      "#f87171",
      marginTop:  5,
    }}>
      {msg}
    </p>
  );
}

const inputBase: React.CSSProperties = {
  width:           "100%",
  padding:         "12px 14px",
  background:      "rgba(255,255,255,0.05)",
  border:          "1px solid rgba(255,255,255,0.10)",
  borderRadius:    10,
  color:           "#fff",
  fontFamily:      "'DM Sans', sans-serif",
  fontSize:        "14px",
  fontWeight:      400,
  outline:         "none",
  transition:      "border-color 0.2s ease, background 0.2s ease",
  boxSizing:       "border-box",
};

// ─── SUCCESS STATE ────────────────────────────────────────────────────────────

function SuccessCard() {
  return (
    <div style={{
      textAlign:    "center",
      padding:      "48px 24px",
      animation:    "wl-fadein 0.6s ease both",
    }}>
      {/* Check circle */}
      <div style={{
        width:        56,
        height:       56,
        borderRadius: "50%",
        background:   "rgba(74,222,128,0.12)",
        border:       "1px solid rgba(74,222,128,0.3)",
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
        margin:       "0 auto 24px",
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="#4ade80" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h2 style={{
        fontFamily:   "'Sora', sans-serif",
        fontWeight:   800,
        fontSize:     "clamp(1.5rem,3vw,2rem)",
        color:        "#fff",
        letterSpacing: "-0.02em",
        marginBottom: 12,
      }}>
        You&apos;re on the list.
      </h2>

      <p style={{
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 400,
        fontSize:   "15px",
        color:      "rgba(255,255,255,0.48)",
        lineHeight: 1.7,
        maxWidth:   380,
        margin:     "0 auto 32px",
      }}>
        We&apos;ll reach out when we&apos;re ready to onboard your school.
        Keep an eye on your inbox.
      </p>

      <Link
        href="/"
        style={{
          display:        "inline-flex",
          alignItems:     "center",
          gap:            6,
          fontFamily:     "'DM Sans', sans-serif",
          fontWeight:     500,
          fontSize:       "14px",
          color:          "rgba(255,255,255,0.38)",
          textDecoration: "none",
          transition:     "color 0.2s ease",
        }}
      >
        ← Back to homepage
      </Link>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function WaitlistPage() {
  const [state,  setState]  = useState<FormState>(INITIAL);
  const [banner, setBanner] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set(field: Field, value: string) {
    setState((s) => ({
      ...s,
      values:      { ...s.values,      [field]: value },
      fieldErrors: { ...s.fieldErrors, [field]: undefined },
    }));
    setBanner(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);

    startTransition(async () => {
      const result: WaitlistResult = await joinWaitlist(state.values);

      if (result.ok) {
        setState((s) => ({ ...s, submitted: true }));
        return;
      }

      if (result.fieldErrors) {
        setState((s) => ({ ...s, fieldErrors: result.fieldErrors ?? {} }));
      }
      setBanner(result.message);
    });
  }

  const { values, fieldErrors, submitted } = state;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');

        @keyframes wl-fadein { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes wl-linegrow { from{transform:scaleX(0);transform-origin:left} to{transform:scaleX(1);transform-origin:left} }

        *, *::before, *::after { box-sizing: border-box; }

        .wl-input:focus {
          border-color: rgba(139,127,245,0.5) !important;
          background:   rgba(139,127,245,0.06) !important;
        }
        .wl-input.error {
          border-color: rgba(248,113,113,0.5) !important;
        }
        .wl-input::placeholder { color: rgba(255,255,255,0.22); }
        .wl-input option       { background: #0f1124; color: #fff; }

        .wl-submit {
          width:           100%;
          padding:         14px;
          background:      linear-gradient(135deg, #5B4FE9 0%, #7C71F0 100%);
          color:           #fff;
          font-family:     'DM Sans', sans-serif;
          font-weight:     600;
          font-size:       15px;
          border-radius:   12px;
          border:          none;
          cursor:          pointer;
          box-shadow:      0 4px 24px rgba(91,79,233,0.38);
          transition:      box-shadow 0.3s ease, transform 0.2s ease, opacity 0.2s ease;
        }
        .wl-submit:hover:not(:disabled)  { box-shadow: 0 8px 32px rgba(91,79,233,0.55); transform: translateY(-1px); }
        .wl-submit:active:not(:disabled) { transform: translateY(0); }
        .wl-submit:disabled              { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <main style={{
        minHeight:       "100svh",
        background:      "#080B18",
        display:         "flex",
        flexDirection:   "column",
        alignItems:      "center",
        justifyContent:  "center",
        padding:         "clamp(80px,12vh,120px) clamp(20px,5vw,40px) 60px",
        position:        "relative",
        overflow:        "hidden",
      }}>

        {/* Aurora blobs */}
        <div style={{
          position:     "absolute", top: "-10%", left: "-5%",
          width:        "55vw",     height: "55vw",
          borderRadius: "50%",      pointerEvents: "none",
          background:   "radial-gradient(circle, rgba(91,79,233,0.28) 0%, transparent 70%)",
          filter:       "blur(80px)",
        }} />
        <div style={{
          position:     "absolute", bottom: "0%", right: "-5%",
          width:        "45vw",     height: "45vw",
          borderRadius: "50%",      pointerEvents: "none",
          background:   "radial-gradient(circle, rgba(26,111,168,0.22) 0%, transparent 70%)",
          filter:       "blur(90px)",
        }} />

        {/* Top accent line */}
        <div style={{
          position:   "absolute", top: 0, left: 0, right: 0, height: "2px",
          background: "linear-gradient(90deg, transparent 0%, #5B4FE9 25%, #8B7FF5 60%, transparent 100%)",
          animation:  "wl-linegrow 1s ease 0.1s both",
        }} />

        {/* Card */}
        <div style={{
          position:     "relative",
          zIndex:       2,
          width:        "100%",
          maxWidth:     480,
          background:   "rgba(255,255,255,0.03)",
          border:       "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding:      "clamp(28px,5vw,44px)",
          animation:    "wl-fadein 0.7s cubic-bezier(.22,1,.36,1) 0.15s both",
        }}>

          {submitted ? <SuccessCard /> : (
            <>
              {/* Header */}
              <div style={{ marginBottom: 32, textAlign: "center" }}>
                {/* Live dot */}
                <div style={{
                  display:        "inline-flex",
                  alignItems:     "center",
                  gap:            7,
                  marginBottom:   18,
                }}>
                  <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
                    <span style={{
                      position:     "absolute", inset: 0,
                      borderRadius: "50%",      background: "#4ade80",
                      animation:    "ea-ping 1.8s ease-out infinite", opacity: 0.5,
                    }} />
                    <span style={{
                      position:     "relative", display: "inline-block",
                      width:        8,          height: 8,
                      borderRadius: "50%",      background: "#4ade80",
                    }} />
                  </span>
                  <span style={{
                    fontFamily:    "'DM Sans', sans-serif",
                    fontSize:      "12px",
                    fontWeight:    500,
                    color:         "rgba(255,255,255,0.40)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}>
                    Early access
                  </span>
                </div>

                <h1 style={{
                  fontFamily:    "'Sora', sans-serif",
                  fontWeight:    800,
                  fontSize:      "clamp(1.6rem,4vw,2.1rem)",
                  color:         "#fff",
                  letterSpacing: "-0.022em",
                  lineHeight:    1.1,
                  marginBottom:  10,
                }}>
                  Join the waitlist
                </h1>

                <p style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 400,
                  fontSize:   "14px",
                  color:      "rgba(255,255,255,0.42)",
                  lineHeight: 1.7,
                }}>
                  Be among the first schools in Ghana to get access to Edujay.
                </p>
              </div>

              {/* Banner */}
              {banner && (
                <div style={{
                  padding:      "11px 14px",
                  background:   "rgba(248,113,113,0.10)",
                  border:       "1px solid rgba(248,113,113,0.25)",
                  borderRadius: 10,
                  marginBottom: 20,
                  fontFamily:   "'DM Sans', sans-serif",
                  fontSize:     "13px",
                  color:        "#f87171",
                }}>
                  {banner}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} noValidate>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                  {/* Name */}
                  <div>
                    <Label>Your name</Label>
                    <input
                      className={`wl-input${fieldErrors.name ? " error" : ""}`}
                      style={inputBase}
                      type="text"
                      placeholder="Kwame Mensah"
                      value={values.name}
                      onChange={(e) => set("name", e.target.value)}
                      disabled={isPending}
                      autoComplete="name"
                    />
                    <FieldError msg={fieldErrors.name} />
                  </div>

                  {/* School name */}
                  <div>
                    <Label>School name</Label>
                    <input
                      className={`wl-input${fieldErrors.schoolName ? " error" : ""}`}
                      style={inputBase}
                      type="text"
                      placeholder="Accra Academy Senior High School"
                      value={values.schoolName}
                      onChange={(e) => set("schoolName", e.target.value)}
                      disabled={isPending}
                    />
                    <FieldError msg={fieldErrors.schoolName} />
                  </div>

                  {/* Email */}
                  <div>
                    <Label>Work email</Label>
                    <input
                      className={`wl-input${fieldErrors.email ? " error" : ""}`}
                      style={inputBase}
                      type="email"
                      placeholder="kwame@accraacademy.edu.gh"
                      value={values.email}
                      onChange={(e) => set("email", e.target.value)}
                      disabled={isPending}
                      autoComplete="email"
                    />
                    <FieldError msg={fieldErrors.email} />
                  </div>

                  {/* Role */}
                  <div>
                    <Label>Your role</Label>
                    <select
                      className={`wl-input${fieldErrors.role ? " error" : ""}`}
                      style={{ ...inputBase, appearance: "none", cursor: "pointer" }}
                      value={values.role}
                      onChange={(e) => set("role", e.target.value)}
                      disabled={isPending}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <FieldError msg={fieldErrors.role} />
                  </div>

                  {/* Message — optional */}
                  <div>
                    <Label>
                      Anything you&apos;d like us to know?{" "}
                      <span style={{ color: "rgba(255,255,255,0.25)", fontWeight: 400 }}>
                        (optional)
                      </span>
                    </Label>
                    <textarea
                      className={`wl-input${fieldErrors.message ? " error" : ""}`}
                      style={{ ...inputBase, resize: "vertical", minHeight: 88 }}
                      placeholder="School size, specific needs, anything helps..."
                      value={values.message}
                      onChange={(e) => set("message", e.target.value)}
                      disabled={isPending}
                      maxLength={500}
                    />
                    <div style={{
                      display:        "flex",
                      justifyContent: "space-between",
                      alignItems:     "center",
                      marginTop:      4,
                    }}>
                      <FieldError msg={fieldErrors.message} />
                      <span style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize:   "11px",
                        color:      "rgba(255,255,255,0.22)",
                        marginLeft: "auto",
                      }}>
                        {(values.message ?? "").length}/500
                      </span>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    className="wl-submit"
                    disabled={isPending}
                    style={{ marginTop: 4 }}
                  >
                    {isPending ? "Joining..." : "Join the Waitlist"}
                  </button>

                </div>
              </form>

              {/* Footer note */}
              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize:   "12px",
                color:      "rgba(255,255,255,0.22)",
                textAlign:  "center",
                marginTop:  20,
                lineHeight: 1.6,
              }}>
                No spam. No commitment. We&apos;ll only contact you when we&apos;re
                ready to onboard your school.
              </p>
            </>
          )}
        </div>

        {/* Back link */}
        {!submitted && (
          <Link href="/" style={{
            position:       "relative",
            zIndex:         2,
            marginTop:      24,
            fontFamily:     "'DM Sans', sans-serif",
            fontSize:       "13px",
            fontWeight:     500,
            color:          "rgba(255,255,255,0.28)",
            textDecoration: "none",
            transition:     "color 0.2s ease",
          }}>
            ← Back to homepage
          </Link>
        )}
      </main>
    </>
  );
}
