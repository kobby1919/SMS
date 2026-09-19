"use client";

type SocialAuthStrategy = "oauth_google" | "oauth_microsoft";

type SocialAuthButtonsProps = {
  disabled?: boolean;
  onSelect: (strategy: SocialAuthStrategy) => void;
};

const providers: Array<{ label: string; strategy: SocialAuthStrategy; mark: string }> = [
  { label: "Google", strategy: "oauth_google", mark: "G" },
  { label: "Microsoft", strategy: "oauth_microsoft", mark: "M" },
];

export type { SocialAuthStrategy };

export default function SocialAuthButtons({ disabled = false, onSelect }: SocialAuthButtonsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs font-black uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        <span>Or continue with</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {providers.map((provider) => (
          <button
            key={provider.strategy}
            type="button"
            onClick={() => onSelect(provider.strategy)}
            disabled={disabled}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-black text-[#061f5f] transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-[#061f5f]">
              {provider.mark}
            </span>
            {provider.label}
          </button>
        ))}
      </div>
      <p className="text-center text-xs font-semibold leading-5 text-slate-500">
        Social sign-in still follows Edujay invite and role checks.
      </p>
    </div>
  );
}
