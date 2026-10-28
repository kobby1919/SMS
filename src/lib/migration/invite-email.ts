type InviteEmailResult = { ok: true; provider: "resend" | "console" } | { ok: false; provider: "resend"; message: string };

export const newInviteEmailCounts = () => ({ emailsAccepted: 0, emailsFailed: 0, emailsNotSent: 0 });

export async function attemptInviteEmail(send: () => Promise<InviteEmailResult>): Promise<InviteEmailResult> {
  try {
    const result = await send();
    return result.ok ? result : { ok: false, provider: "resend", message: "Email sending failed. Check the recipient address before retrying the existing invitation." };
  } catch {
    return { ok: false, provider: "resend", message: "Email sending could not be confirmed. Check its provider status before retrying the existing invitation." };
  }
}

export function recordInviteEmailOutcome(counts: ReturnType<typeof newInviteEmailCounts>, result: InviteEmailResult) {
  if (!result.ok) counts.emailsFailed++;
  else if (result.provider === "resend") counts.emailsAccepted++;
  else counts.emailsNotSent++;
  return !result.ok ? result.message : result.provider === "console" ? "Email delivery is not configured. The invitation was prepared but no email was sent." : null;
}
