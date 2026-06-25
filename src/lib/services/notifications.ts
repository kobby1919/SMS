type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type EmailResult =
  | { ok: true; provider: "resend" | "console" }
  | { ok: false; provider: "resend"; message: string };

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function emailFromAddress() {
  return process.env.EMAIL_FROM ?? "Edujay <onboarding@edujay.app>";
}

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.info("[email:console]", {
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return { ok: true, provider: "console" };
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    return {
      ok: false,
      provider: "resend",
      message: await response.text(),
    };
  }

  return { ok: true, provider: "resend" };
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
        <h1 style="font-size:22px;margin:0 0 12px">Set up ${input.schoolName} on Edujay</h1>
        <p>You have been invited to become the first admin for <strong>${input.schoolName}</strong>.</p>
        <p>
          <a href="${input.inviteUrl}" style="display:inline-block;background:#1d4ed8;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
            Accept invite
          </a>
        </p>
        <p style="color:#4b5563;font-size:14px">This invite expires on ${expiry}. Sign in with this same email address to accept it.</p>
      </div>
    `,
  });
}
