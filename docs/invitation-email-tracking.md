# Invitation Email Tracking

## Scope

Teacher, parent, bursar, collector and school-admin invitations use the same tracked send path, including bulk migration invitations and resends. Creating an ordinary teacher invitation now attempts email sending instead of returning a test link only.

Each send has a separate attempt identifier, persisted before contacting Resend. Existing invitation audit tables hold the attempt, provider email ID, current status and a bounded status history. No schema migration is required. Invitation URLs, raw tokens, email bodies, webhook payloads and provider error text are not stored in this tracking record.

## Status And Access

- Sending: attempt saved, provider response not yet available.
- Accepted by email provider: provider returned an email ID, but delivery is not proven.
- Sent by email provider: signed `email.sent` event received.
- Delivered to mail server: signed `email.delivered` event received. This does not prove inbox placement or that the person read it.
- Delivery delayed, Bounced, Spam complaint or Sending failed: corresponding signed provider event or synchronous rejection.
- Not sent: email provider is unconfigured; console mode is never treated as delivery.
- Sending unconfirmed: transport failure or unusable provider response; check the provider before manually resending.

School admins use `/admin/invite-emails`, linked in Settings And Follow-Up. Platform admins use `/platform/invite-emails`, linked from Platform Onboarding, and select a school. The views display the latest 100 tracked attempts and separately show invitation acceptance/revocation/expiry. Data queries are school-scoped and server-authorized. Older invitations have no new delivery evidence and are not falsely backfilled.

## Provider Setup Required

Configure Resend to POST to `https://edujay.app/api/webhooks/notifications/resend`. Subscribe to `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed` and `email.suppressed`.

The endpoint's signing secret must be configured as `RESEND_WEBHOOK_SECRET` in the matching Vercel environment. Production and staging must have separate, correctly scoped endpoints/configuration. Configure the secret through the provider and hosting consoles; never paste it into chat or Git. Redeploy after changing environment variables.

The callback verifies Svix signature headers and timestamp before processing. Provider email ID or the signed attempt tag correlates the event to the saved attempt; mismatched recipients/message IDs are rejected. Duplicate and older lower-priority events cannot regress delivery/terminal outcomes. A compare-and-swap failure returns a server error so the provider can retry. Resends preserve earlier attempts; callbacks for an old send never modify a newer attempt.

Open/click tracking is not added. No automatic resend is triggered by callbacks. Existing app-notification delivery callbacks continue through their existing path.

## Safety Invariants

- Persist a rotated school-admin invite token with a compare-and-swap before email tracking or sending begins. Concurrent acceptance, revocation or another rotation must stop the send.
- Reject accepted, revoked and expired invitations in the shared send path. Signed callbacks must match both the recipient and any supplied attempt tag.
- Escape dynamic HTML fields in every invitation template; plain-text content remains unchanged.
- Treat provider acceptance separately from subsequent log writes. Retry only status persistence, never the provider send. A logging outage must return a warning, not falsely claim that an already-sent email failed or that the saved invitation was not created.

Reference: [Resend email webhooks and message correlation](https://resend.com/changelog/message-id-for-sent-emails).

## Verification Before Pilot

Unit tests mock provider responses and signed callbacks, including early, duplicate and out-of-order callbacks, mismatches, failures, console mode and school isolation. Browser fixtures use synthetic data and send no messages. They do not certify that provider configuration is live.

Before opening to schools, complete a controlled provider-accepted send and signed delivery/bounce walkthrough in the deployed environment using an authorized test inbox/provider test recipient. Confirm the status changes in the correct school's activity page. Confirm invalid signatures cannot update it. Check Vercel logs and provider retries without exposing secrets. Continue the full deferred production checks in `docs/production-readiness.md`, Point 5; passing code tests and successful deployment are not production certification.
