import { beginInviteEmail, updateInviteEmail, type InviteEmailKind } from "@/src/lib/services/invite-email-tracking";

type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  invitation?: { kind: InviteEmailKind; inviteUrl: string };
};

type EmailResult =
  | { ok: true; provider: "resend" | "console"; providerMessageId?: string; trackingWarning?: string }
  | { ok: false; provider: "resend"; message: string };

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function escapeEmailHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function emailFromAddress() {
  return process.env.EMAIL_FROM ?? "Edujay <onboarding@edujay.app>";
}

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const attempt = input.invitation ? await beginInviteEmail(input.invitation.kind, input.invitation.inviteUrl, input.to) : null;
  const apiKey = process.env.RESEND_API_KEY;
  const recordOutcome = async (status: Parameters<typeof updateInviteEmail>[1], messageId?: string) => {
    if (!attempt) return undefined;
    for (let retry = 0; retry < 2; retry++) {
      try {
        await updateInviteEmail(attempt, status, messageId);
        return undefined;
      } catch {
        // Retry only the database write, never the provider send.
      }
    }
    return "Email status recording is temporarily unavailable. Check email activity before resending.";
  };

  if (!apiKey) {
    console.info("[email:console]", {
      to: input.to,
      subject: input.subject,
      ...(attempt ? {} : { text: input.text }),
    });
    const trackingWarning = await recordOutcome("NOT_SENT");
    return { ok: true, provider: "console", trackingWarning };
  }

  let response: Response;
  let providerMessageId: string | undefined;
  try {
    response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(attempt ? { "Idempotency-Key": `invite-email-${attempt.attemptId}` } : {}),
    },
    body: JSON.stringify({
      from: emailFromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(attempt ? { tags: [{ name: "edujay_invite_attempt", value: attempt.attemptId }] } : {}),
    }),
  });

    if (response.ok) {
      const body: unknown = await response.json();
      providerMessageId = body && typeof body === "object" && "id" in body && typeof body.id === "string" && body.id.trim() ? body.id : undefined;
      if (attempt && !providerMessageId) throw new Error("Provider acceptance could not be verified.");
    }
  } catch {
    await recordOutcome("UNKNOWN");
    return { ok: false, provider: "resend", message: "Email sending could not be confirmed. Check email activity before resending this invitation." };
  }

  if (!response.ok) {
    await recordOutcome("FAILED");
    return {
      ok: false,
      provider: "resend",
      message: "Email sending failed. Review the recipient address and resend the existing invitation.",
    };
  }

  const trackingWarning = await recordOutcome("ACCEPTED", providerMessageId);
  return { ok: true, provider: "resend", providerMessageId, trackingWarning };
}

export function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function sendFirstAdminInviteEmail(input: {
  to: string;
  schoolName: string;
  inviteUrl: string;
  expiresAt: Date;
}) {
  const expiry = input.expiresAt.toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return sendEmail({
    invitation: { kind: "ADMIN", inviteUrl: input.inviteUrl },
    to: input.to,
    subject: `Set up ${input.schoolName} on Edujay`,
    text: [
      `You have been invited to set up ${input.schoolName} on Edujay.`,
      "",
      `Open this secure invite link: ${input.inviteUrl}`,
      "",
      `This invite expires on ${expiry}.`,
      "Sign in with this same email address to accept the invitation.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h1 style="font-size:22px;margin:0 0 12px">Set up ${escapeEmailHtml(input.schoolName)} on Edujay</h1>
        <p>You have been invited to become the first admin for <strong>${escapeEmailHtml(input.schoolName)}</strong>.</p>
        <p>
          <a href="${escapeEmailHtml(input.inviteUrl)}" style="display:inline-block;background:#1d4ed8;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
            Accept invite
          </a>
        </p>
        <p style="color:#4b5563;font-size:14px">This invite expires on ${escapeEmailHtml(expiry)}. Sign in with this same email address to accept it.</p>
      </div>
    `,
  });
}
export async function sendSchoolAdminInviteEmail(input: {
  to: string;
  schoolName: string;
  inviteUrl: string;
  expiresAt: Date;
}) {
  const expiry = input.expiresAt.toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return sendEmail({
    invitation: { kind: "ADMIN", inviteUrl: input.inviteUrl },
    to: input.to,
    subject: `${input.schoolName} invited you as an Edujay admin`,
    text: [
      `You have been invited to manage ${input.schoolName} on Edujay as a school admin.`,
      "",
      `Open this secure invite link: ${input.inviteUrl}`,
      "",
      `This invite expires on ${expiry}.`,
      "Sign in or sign up with this same email address to accept the invitation.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h1 style="font-size:22px;margin:0 0 12px">Join ${escapeEmailHtml(input.schoolName)} on Edujay</h1>
        <p>You have been invited to manage <strong>${escapeEmailHtml(input.schoolName)}</strong> as a school admin.</p>
        <p>
          <a href="${escapeEmailHtml(input.inviteUrl)}" style="display:inline-block;background:#1d4ed8;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
            Accept admin invite
          </a>
        </p>
        <p style="color:#4b5563;font-size:14px">This invite expires on ${escapeEmailHtml(expiry)}. Sign in or sign up with this same email address to accept it.</p>
      </div>
    `,
  });
}

export async function sendTeacherInviteEmail(input: {
  to: string;
  schoolName: string;
  teacherName: string;
  inviteUrl: string;
  expiresAt: Date;
}) {
  const expiry = input.expiresAt.toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return sendEmail({
    invitation: { kind: "TEACHER", inviteUrl: input.inviteUrl },
    to: input.to,
    subject: `${input.schoolName} invited you to Edujay`,
    text: [
      `Hello ${input.teacherName},`,
      "",
      `${input.schoolName} has invited you to join Edujay as a teacher.`,
      "",
      `Open this secure invite link: ${input.inviteUrl}`,
      "",
      `This invite expires on ${expiry}.`,
      "Sign in or sign up with this same email address to accept the invitation.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h1 style="font-size:22px;margin:0 0 12px">Join ${escapeEmailHtml(input.schoolName)} on Edujay</h1>
        <p>Hello <strong>${escapeEmailHtml(input.teacherName)}</strong>,</p>
        <p><strong>${escapeEmailHtml(input.schoolName)}</strong> has invited you to join Edujay as a teacher.</p>
        <p>
          <a href="${escapeEmailHtml(input.inviteUrl)}" style="display:inline-block;background:#1d4ed8;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
            Accept teacher invite
          </a>
        </p>
        <p style="color:#4b5563;font-size:14px">This invite expires on ${escapeEmailHtml(expiry)}. Sign in or sign up with this same email address to accept it.</p>
      </div>
    `,
  });
}
export async function sendParentInviteEmail(input: {
  to: string;
  schoolName: string;
  parentName: string;
  wardNames: string[];
  inviteUrl: string;
  expiresAt: Date;
}) {
  const expiry = input.expiresAt.toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const wards = input.wardNames.length > 0 ? input.wardNames.join(", ") : "your ward";

  return sendEmail({
    invitation: { kind: "PARENT", inviteUrl: input.inviteUrl },
    to: input.to,
    subject: `${input.schoolName} invited you to Edujay`,
    text: [
      `Hello ${input.parentName},`,
      "",
      `${input.schoolName} has invited you to join Edujay as a parent/guardian for ${wards}.`,
      "",
      `Open this secure invite link: ${input.inviteUrl}`,
      "",
      `This invite expires on ${expiry}.`,
      "Sign in or sign up with this same email address to accept the invitation.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h1 style="font-size:22px;margin:0 0 12px">Join ${escapeEmailHtml(input.schoolName)} on Edujay</h1>
        <p>Hello <strong>${escapeEmailHtml(input.parentName)}</strong>,</p>
        <p><strong>${escapeEmailHtml(input.schoolName)}</strong> has invited you to join Edujay as a parent/guardian for <strong>${escapeEmailHtml(wards)}</strong>.</p>
        <p>
          <a href="${escapeEmailHtml(input.inviteUrl)}" style="display:inline-block;background:#1d4ed8;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
            Accept parent invite
          </a>
        </p>
        <p style="color:#4b5563;font-size:14px">This invite expires on ${escapeEmailHtml(expiry)}. Sign in or sign up with this same email address to accept it.</p>
      </div>
    `,
  });
}
export async function sendBursarInviteEmail(input: {
  to: string;
  schoolName: string;
  bursarName: string;
  inviteUrl: string;
  expiresAt: Date;
}) {
  const expiry = input.expiresAt.toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return sendEmail({
    invitation: { kind: "BURSAR", inviteUrl: input.inviteUrl },
    to: input.to,
    subject: `${input.schoolName} invited you to Edujay finance`,
    text: [
      `Hello ${input.bursarName},`,
      "",
      `${input.schoolName} has invited you to join Edujay as the school bursar.`,
      "",
      `Open this secure invite link: ${input.inviteUrl}`,
      "",
      `This invite expires on ${expiry}.`,
      "Sign in or sign up with this same email address to accept the invitation.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h1 style="font-size:22px;margin:0 0 12px">Join ${escapeEmailHtml(input.schoolName)} finance on Edujay</h1>
        <p>Hello <strong>${escapeEmailHtml(input.bursarName)}</strong>,</p>
        <p><strong>${escapeEmailHtml(input.schoolName)}</strong> has invited you to manage finance records on Edujay as the school bursar.</p>
        <p>
          <a href="${escapeEmailHtml(input.inviteUrl)}" style="display:inline-block;background:#1d4ed8;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
            Accept bursar invite
          </a>
        </p>
        <p style="color:#4b5563;font-size:14px">This invite expires on ${escapeEmailHtml(expiry)}. Sign in or sign up with this same email address to accept it.</p>
      </div>
    `,
  });
}

export async function sendCollectorInviteEmail(input: {
  to: string;
  schoolName: string;
  collectorName: string;
  inviteUrl: string;
  expiresAt: Date;
}) {
  const expiry = input.expiresAt.toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return sendEmail({
    invitation: { kind: "COLLECTOR", inviteUrl: input.inviteUrl },
    to: input.to,
    subject: `${input.schoolName} invited you to Edujay daily collections`,
    text: [
      `Hello ${input.collectorName},`,
      "",
      `${input.schoolName} has invited you to join Edujay as a daily collection collector.`,
      "",
      "You will only see collection setups assigned to you.",
      "",
      `Open this secure invite link: ${input.inviteUrl}`,
      "",
      `This invite expires on ${expiry}.`,
      "Sign in or sign up with this same email address to accept the invitation.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h1 style="font-size:22px;margin:0 0 12px">Join ${escapeEmailHtml(input.schoolName)} daily collections on Edujay</h1>
        <p>Hello <strong>${escapeEmailHtml(input.collectorName)}</strong>,</p>
        <p><strong>${escapeEmailHtml(input.schoolName)}</strong> has invited you to record assigned daily collections on Edujay.</p>
        <p style="color:#4b5563;font-size:14px">You will only see collection setups assigned to you. Bursar/admin review is still required before submitted money counts as confirmed.</p>
        <p>
          <a href="${escapeEmailHtml(input.inviteUrl)}" style="display:inline-block;background:#1d4ed8;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
            Accept collector invite
          </a>
        </p>
        <p style="color:#4b5563;font-size:14px">This invite expires on ${escapeEmailHtml(expiry)}. Sign in or sign up with this same email address to accept it.</p>
      </div>
    `,
  });
}

