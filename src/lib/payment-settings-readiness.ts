type PaymentSettingsReadinessInput = {
  onlinePaymentsEnabled: boolean;
  publicKey: string | null;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  acceptedPaymentMethods: unknown[];
};

export function isSchoolPaymentProviderConfigured(settings: PaymentSettingsReadinessInput) {
  return (
    settings.onlinePaymentsEnabled &&
    Boolean(settings.publicKey) &&
    settings.hasSecretKey &&
    settings.hasWebhookSecret &&
    settings.acceptedPaymentMethods.length > 0
  );
}
