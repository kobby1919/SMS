"use client";

import { useSyncExternalStore } from "react";
import { currentCAEntryWindow, type ClientCAEntryWindow } from "@/src/lib/ca-entry-window-status";

function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 500);
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

export function useCAEntryWindow(status: ClientCAEntryWindow) {
  const allowed = useSyncExternalStore(
    subscribe,
    () => currentCAEntryWindow(status).allowed,
    () => status.allowed,
  );
  return allowed ? status : currentCAEntryWindow(status);
}
