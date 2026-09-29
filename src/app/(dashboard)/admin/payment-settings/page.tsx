import { CreditCard } from "lucide-react";
import AdminPaymentSettingsForm, { type AdminPaymentSettingsFormValue } from "@/src/components/AdminPaymentSettingsForm";
import { requirePageSession } from "@/src/lib/authz";
import { ensureDefaultSchoolPaymentSettings } from "@/src/lib/services/school-payment-settings";

export const dynamic = "force-dynamic";

const AdminPaymentSettingsPage = async () => {
  const { schoolId } = await requirePageSession(["admin"]);
  const settings = await ensureDefaultSchoolPaymentSettings(schoolId);
  const formSettings: AdminPaymentSettingsFormValue = {
    onlinePaymentsEnabled: settings.onlinePaymentsEnabled,
    provider: settings.provider === "HUBTEL" || settings.provider === "FLUTTERWAVE" ? settings.provider : "PAYSTACK",
    publicKey: settings.publicKey,
    hasSecretKey: Boolean(settings.encryptedSecretKey),
    hasWebhookSecret: Boolean(settings.encryptedWebhookSecret),
    acceptedPaymentMethods: settings.acceptedPaymentMethods,
    settlementAccountReference: settings.settlementAccountReference,
    feePayerRule: settings.feePayerRule,
  };
  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-400/10 p-2 text-emerald-200">
            <CreditCard size={20} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Finance setup</p>
            <h1 className="mt-1 text-xl font-black">School Payment Settings</h1>
            <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Decide whether this school accepts online payments, which provider is trusted, how fees are charged, and which methods parents can use.
            </p>
          </div>
        </div>
      </div>

      <AdminPaymentSettingsForm settings={formSettings} />
    </div>
  );
};

export default AdminPaymentSettingsPage;
