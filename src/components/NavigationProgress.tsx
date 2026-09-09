"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function isInternalNavigation(anchor: HTMLAnchorElement) {
  if (
    !anchor.href ||
    anchor.target === "_blank" ||
    anchor.hasAttribute("download")
  ) {
    return false;
  }

  const nextUrl = new URL(anchor.href, window.location.href);
  const currentUrl = new URL(window.location.href);

  return (
    nextUrl.origin === currentUrl.origin &&
    `${nextUrl.pathname}${nextUrl.search}` !==
      `${currentUrl.pathname}${currentUrl.search}`
  );
}

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]");

      if (anchor instanceof HTMLAnchorElement && isInternalNavigation(anchor)) {
        setIsNavigating(true);
      }
    };

    const handleSubmit = () => setIsNavigating(true);

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  useEffect(() => {
    if (!isNavigating) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsNavigating(false);
    }, 250);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [pathname, searchParams, isNavigating]);

  if (!isNavigating) return null;

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-[100] h-1 overflow-hidden bg-transparent">
      <div className="h-full w-1/2 animate-edujay-progress rounded-r-full bg-[#2563EB] shadow-[0_0_16px_rgba(37,99,235,0.45)]" />
    </div>
  );
}
