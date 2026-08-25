// src/components/UserButtonWrapper.tsx
"use client";

import { UserButton } from "@clerk/nextjs";
import { Home, Settings } from "lucide-react";

export default function UserButtonWrapper() {
  return (
    <UserButton
      afterSignOutUrl="/"
      userProfileMode="modal"
      appearance={{
        variables: {
          colorPrimary: "#2563eb",
          borderRadius: "0.875rem",
          fontFamily: "inherit",
        },
        elements: {
          avatarBox: "h-8 w-8",
          userButtonPopoverCard:
            "rounded-2xl border border-gray-100 shadow-2xl",
          userButtonPopoverActionButton:
            "text-sm font-semibold text-gray-700 hover:bg-blue-50",
          userButtonPopoverFooter: "hidden",
          userProfileModalContent:
            "rounded-2xl border border-gray-100 shadow-2xl",
        },
      }}
    >
      <UserButton.MenuItems>
        <UserButton.Link
          label="Edujay home"
          labelIcon={<Home size={16} />}
          href="/"
        />
        <UserButton.Link
          label="Notification settings"
          labelIcon={<Settings size={16} />}
          href="/parent/updates#preferences"
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}
