"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CreditCard, KeyRound, Landmark, ShieldCheck } from "lucide-react";
import {
  saveSchoolPaymentSettingsWithState,
  type SchoolPaymentSettingsActionState,
} from "@/src/lib/actions/schoolPaymentSettingsActions";
import { isSchoolPaymentProviderConfigured } from "@/src/lib/payment-settings-readiness";

const initialState: SchoolPaymentSettingsActionState = {
  status: "idle",
  message: "",
};

const methodOptions = [
  { value: "MTN_MOMO", label: "MTN Mobile Money" },
  { value: "VODAFONE_CASH", label: "Telecel Cash" },
  { value: "AIRTELTIGO_MONEY", label: "AT Money" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "POS", label: "POS" },
] as const;

export type AdminPaymentSettingsFormValue = {
  onlinePaymentsEnabled: boolean;
  provider: "PAYSTACK" | "HUBTEL" | "FLUTTERWAVE";
  publicKey: string | null;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  acceptedPaymentMethods: string[];
  settlementAccountReference: string | null;
  feePayerRule: "SCHOOL_ABSORBS" | "PARENT_PAYS";
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}
      className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      {pending ? "Saving..." : "Save payment settings"}
    </button>
  );
}

export default function AdminPaymentSettingsForm({
  settings,
}: {
  settings: AdminPaymentSettingsFormValue;
}) {
  const [state, formAction] = useActionState(saveSchoolPaymentSettingsWithState, initialState);
  const providerReady = isSchoolPaymentProviderConfigured(settings);

  return (
    <form action={formAction} className="space-y-5">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
            <CreditCard size={18} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-950">Online Payment Control</h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
              Keep this off until the provider keys, webhook secret, accepted methods, and settlement reference have been checked.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <label className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <input type="checkbox" name="onlinePaymentsEnabled" defaultChecked={settings.onlinePaymentsEnabled} />
            <span>
              <span className="block text-sm font-black text-slate-900">Enable online payments</span>
              <span className="block text-xs font-semibold leading-5 text-slate-500">
                Parents can pay online only after this is enabled.
              </span>
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">Provider</span>
            <select
              name="provider"
              defaultValue={settings.provider}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-sky-400"
            >
              <option value="PAYSTACK">Paystack</option>
              <option value="HUBTEL">Hubtel</option>
              <option value="FLUTTERWAVE">Flutterwave</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">Fee payer rule</span>
            <select
              name="feePayerRule"
              defaultValue={settings.feePayerRule}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-sky-400"
            >
              <option value="SCHOOL_ABSORBS">School absorbs charges</option>
              <option value="PARENT_PAYS">Parent pays charges</option>
            </select>
          </label>
        </div>

        <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${
          providerReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
        }`}>
          {providerReady
            ? "Provider setup is ready for checkout integration."
            : "Provider setup is not complete yet. Online checkout will stay blocked until the missing items are saved."}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
            <KeyRound size={18} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-950">Provider Keys</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Secret values are write-only. Leave them blank to keep the currently saved secret.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">Public key</span>
            <input
              name="publicKey"
              defaultValue={settings.publicKey ?? ""}
              placeholder="pk_test_..."
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-sky-400"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">Secret key</span>
            <input
              name="secretKey"
              type="password"
              placeholder={settings.hasSecretKey ? "Saved - leave blank to keep" : "sk_test_..."}
              autoComplete="off"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-sky-400"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">Webhook secret</span>
            <input
              name="webhookSecret"
              type="password"
              placeholder={settings.hasWebhookSecret ? "Saved - leave blank to keep" : "Provider webhook secret"}
              autoComplete="off"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-sky-400"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-indigo-50 p-2 text-indigo-700">
            <Landmark size={18} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-950">Methods And Settlement</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Choose what parents are allowed to use and how the school identifies the provider settlement account.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-400">Accepted payment methods</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {methodOptions.map((method) => (
                <label key={method.value} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-black text-gray-700">
                  <input
                    type="checkbox"
                    name="acceptedPaymentMethods"
                    value={method.value}
                    defaultChecked={settings.acceptedPaymentMethods.includes(method.value)}
                  />
                  {method.label}
                </label>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">Settlement account reference</span>
            <input
              name="settlementAccountReference"
              defaultValue={settings.settlementAccountReference ?? ""}
              placeholder="School account, subaccount, or settlement note"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-sky-400"
            />
            <span className="text-xs font-semibold leading-5 text-gray-400">
              This is a school reference for reconciliation. Provider-specific subaccounts can be added in the checkout step.
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />
          <p className="text-sm font-semibold leading-6 text-slate-600">
            Edujay will still keep manual payments available. Online payments will be confirmed only from verified provider callbacks, not from a browser redirect.
          </p>
        </div>
      </section>

      <div className="flex flex-col items-end gap-3">
        <SubmitButton />
        {state.status !== "idle" && (
          <p
            role="status"
            className={`rounded-xl px-4 py-2 text-sm font-black ${
              state.status === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
