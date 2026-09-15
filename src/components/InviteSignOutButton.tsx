"use client";

import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { useState } from "react";

type InviteSignOutButtonProps = {
  redirectUrl: string;
  label?: string;
};

export default function InviteSignOutButton({
  redirectUrl,
  label = "Sign out and continue",
}: InviteSignOutButtonProps) {
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    await signOut({ redirectUrl });
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-200 px-4 py-3 text-sm font-black text-blue-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
    >
      <LogOut size={16} />
      {isSigningOut ? "Signing out..." : label}
    </button>
  );
}
