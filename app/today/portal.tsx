"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const noop = () => () => {};

/**
 * R7a: renders an overlay straight into document.body, so `fixed inset-0` is the whole window
 * whatever transform an ancestor has (the right-shifted focus screen on a laptop, 08/11).
 * Nothing on the server or during hydration: the overlay appears only after mount.
 */
export function BodyPortal({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? createPortal(children, document.body) : null;
}

/** Turns a key press inside `root` (or on the page itself) into a close, for Esc. */
export function escFrom(root: HTMLElement | null, e: KeyboardEvent): boolean {
  if (e.key !== "Escape" || e.defaultPrevented) return false;
  const t = e.target;
  return t === document.body || t === document.documentElement || (t instanceof Node && !!root?.contains(t));
}

/** Focus back where the child was; if that button is gone, the running chip (then nothing). */
export function returnFocus(opener: Element | null) {
  if (opener instanceof HTMLElement && opener.isConnected && opener !== document.body) {
    opener.focus();
    return;
  }
  document.getElementById("running-chip")?.focus();
}
