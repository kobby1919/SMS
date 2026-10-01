import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assertContains(source, needle, message) {
  assert.ok(
    source.includes(needle),
    `${message}\nMissing source text: ${needle}`,
  );
}

function assertMatches(source, pattern, message) {
  assert.match(source, pattern, message);
}

const paymentIntents = read("src/lib/services/payment-intents.ts");
const webhookProcessor = read("src/lib/services/finance-webhook-processor.ts");
const webhookRoute = read("src/app/api/webhooks/payments/[provider]/route.ts");
const webhookStore = read("src/lib/services/finance-webhooks.ts");
const schema = read("prisma/schema.prisma");
const parentBillPage = read("src/app/(dashboard)/parent/finance/bills/[id]/page.tsx");

test("successful provider payment is applied only inside webhook processor transaction", () => {
  assertContains(webhookProcessor, 'status: "CONFIRMED"', "Webhook processor must create confirmed payments only after provider verification.");
  assertContains(webhookProcessor, 'recordedBy: "system:webhook"', "Confirmed online payments must be stamped as webhook/provider records.");
  assertContains(webhookProcessor, 'await prisma.$transaction', "Confirmed provider payment application must run in a database transaction.");
  assertContains(webhookProcessor, 'amountPaid: { increment: normalized.amount }', "Successful provider payment must update the bill balance from the verified webhook amount.");
});

test("partial online payment is allowed but overpayment is blocked", () => {
  assertContains(paymentIntents, "assertPaymentWithinAllowedOverpay", "Checkout must run amount policy validation before provider checkout.");
  assertContains(paymentIntents, "amount.gt(bill.balance)", "Online checkout must block paying more than the current bill balance.");
  assertContains(webhookProcessor, "assertPaymentWithinAllowedOverpay", "Webhook confirmation must re-check amount policy before applying money.");
  assertContains(webhookProcessor, "Prisma.Decimal.min(remaining, lineBalance)", "Webhook processor must support allocating partial payments across bill line balances.");
});

test("duplicate webhooks are idempotent and do not apply money twice", () => {
  assertContains(webhookProcessor, "idempotencyKey = `payment:${event.provider}:${normalized.externalReference}`", "Provider reference must produce a stable payment idempotency key.");
  assertContains(webhookProcessor, 'existingPayment && existingPayment.status === "CONFIRMED"', "Existing confirmed provider payment must be detected before applying balance.");
  assertContains(webhookProcessor, "balanceApplied: false", "Duplicate provider webhook must be marked processed without applying balance again.");
});

test("failed provider payment updates the intent without creating a receipt", () => {
  assertContains(webhookProcessor, 'effectivePaymentStatus !== "CONFIRMED"', "Non-success provider statuses must avoid the confirmed-payment path.");
  assertContains(webhookProcessor, 'status: effectivePaymentStatus === "FAILED" ? "FAILED" : "PENDING_PROVIDER"', "Failed provider status must update the payment intent.");
  assertContains(webhookProcessor, "return markWebhookProcessed(webhookEventId, null, \"PROCESSED\")", "Failed/pending provider statuses must finish without linking a payment receipt.");
});

test("abandoned checkout expires without touching bills or receipts", () => {
  assertContains(paymentIntents, 'status: "EXPIRED"', "Expired checkout attempts must be marked abandoned/expired.");
  assertContains(paymentIntents, "Checkout expired before provider confirmation.", "Expired checkout must explain that provider confirmation never arrived.");
  assertContains(paymentIntents, 'const paidIntent = matchingIntents.find((candidate) => candidate.status === "PAID")', "Paid intents must block checkout reuse after successful payment.");
});

test("wrong amount webhook is rejected before bill application", () => {
  assertContains(webhookProcessor, "Webhook amount does not match the Edujay payment intent amount.", "Webhook amount must match Edujay intent amount.");
  assertContains(webhookProcessor, "Provider verification amount does not match the Edujay payment intent amount.", "Provider verification amount must match Edujay intent amount.");
  assertContains(webhookProcessor, "Webhook bill amount does not match the Edujay payment intent line amount.", "Webhook line amount must match the selected bill line.");
});

test("wrong school or ambiguous provider reference is rejected", () => {
  assertContains(webhookRoute, "resolveWebhookSchoolId(payload)", "Webhook route must use provider metadata school id when present.");
  assertContains(webhookRoute, "intents.length !== 1", "Webhook route must reject ambiguous or missing payment intent references.");
  assertContains(webhookRoute, "Webhook does not match a configured Edujay payment intent.", "Webhook route must not guess a school for unknown references.");
  assert.doesNotMatch(webhookRoute, /resolveWebhookSchoolId\(payload\)\s*\?\?/, "Webhook route must not fall back to trusting payload school id after failed intent lookup.");
});

test("parent can only start checkout for linked ward bills with fee permission", () => {
  assertContains(paymentIntents, 'listActiveParentChildIds(parentId, schoolId, { permission: "fees" })', "Checkout must use active parent-child fee permission scope.");
  assertContains(paymentIntents, "studentId: { in: childIds }", "Checkout bill lookup must be restricted to the parent's linked child ids.");
  assertContains(paymentIntents, "One or more selected bills could not be found for this parent account.", "Unauthorized child bills must fail as not found for the parent.");
});

test("provider browser callback never confirms payment by itself", () => {
  assertContains(paymentIntents, "callbackUrl:", "Checkout provider may return parent to the bill page.");
  assertContains(paymentIntents, "/parent/finance/bills/", "Provider callback URL must land on the parent bill page.");
  assert.doesNotMatch(parentBillPage, /paymentIntent\.update|payment\.create|amountPaid:\s*\{\s*increment/, "Parent callback page must not confirm money or mutate bill balances.");
});

test("webhook without a valid signature is rejected", () => {
  assertContains(webhookRoute, "verifyHmacSignature", "Payment webhook route must verify provider HMAC signature.");
  assertContains(webhookRoute, 'return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 })', "Invalid webhook signatures must return 401.");
  assert.doesNotMatch(webhookRoute, /PAYSTACK_SECRET_KEY\s*\?\?/, "Webhook route must not fall back to a broad environment secret after Step 15 hardening.");
});

test("provider reversal or refund events reverse only verified online payments", () => {
  assertContains(webhookProcessor, "isProviderReversalEvent(event.eventType)", "Webhook processor must route provider reversal/refund events.");
  assertContains(webhookProcessor, "Provider reversal reference does not match any Edujay online payment.", "Provider reversal must match an existing online payment.");
  assertContains(webhookProcessor, "Partial provider refunds are not automated yet.", "Partial refunds must not silently adjust bill balances.");
  assertContains(webhookProcessor, 'reversedBy: "system:webhook"', "Provider reversal must be stamped as webhook/system action.");
});

test("final payment provider safeguards are backed by database uniqueness and webhook idempotency", () => {
  assertContains(schema, "@@unique([schoolId, reference])", "PaymentIntent references must be unique per school.");
  assertContains(schema, "@@unique([schoolId, idempotencyKey])", "PaymentIntent idempotency keys must be unique per school.");
  assertContains(schema, "@@unique([schoolId, receiptNumber])", "Receipt numbers must be unique per school.");
  assertContains(schema, "@@unique([schoolId, externalProvider, externalReference])", "Provider payment references must be unique per school.");
  assertContains(schema, "@@unique([schoolId, idempotencyKey])", "Payment idempotency keys must be protected by the database.");
  assertContains(schema, "paymentId Int     @unique", "A payment must not be reversed more than once.");
  assertContains(schema, "@@unique([provider, providerEventId])", "Provider webhook events must not be stored twice.");
  assertContains(webhookStore, "provider_providerEventId", "Webhook storage must look up existing provider events by provider event id.");
  assertContains(webhookStore, "canRefreshWebhookEvent", "Webhook storage must only refresh events that are safe to retry.");
  assertContains(webhookStore, "idempotencyKey: `webhook:${input.provider}:${input.providerEventId}`", "Webhook processing jobs must be deduped by provider event id.");
});
