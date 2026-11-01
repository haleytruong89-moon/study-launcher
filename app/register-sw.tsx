"use client";

import { useEffect } from "react";

/** Registers the service worker: installable to the Home Screen + Web Push for parents (S5). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal: the app works without a service worker.
    });
  }, []);
  return null;
}
