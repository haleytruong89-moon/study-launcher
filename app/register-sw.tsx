"use client";

import { useEffect } from "react";

/** Registers the (currently empty) service worker so the app can be installed to the Home Screen. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal: the app works without a service worker.
    });
  }, []);
  return null;
}
