"use client";

import Image from "next/image";

type SocialAuthStrategy = "oauth_google";

type SocialAuthButtonsProps = {
  disabled?: boolean;
  onSelect: (strategy: SocialAuthStrategy) => void;
};

export type { SocialAuthStrategy };

export default function SocialAuthButtons({ disabled = false, onSelect }: SocialAuthButtonsProps) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => onSelect("oauth_google")}
        disabled={disabled}
        className="flex h-14 min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-[#061f5f] shadow-sm transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <Image
          src="/google-logo.png"
          alt=""
          width={24}
          height={24}
          className="size-6 object-contain"
        />
        Continue with Google
      </button>
      <p className="text-center text-xs font-semibold leading-5 text-slate-500">
        Google verifies identity. Edujay still checks the invite, role, and school.
      </p>
      <div className="flex items-center gap-3 text-xs font-black uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        <span>Or use password</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
    </div>
  );
}
