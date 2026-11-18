"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps the child's session fresh from ONE place (18/11/2026: children were asked for their PIN
 * in the middle of work). The browser client refreshes the token shortly BEFORE it expires and
 * holds a cross-tab lock while doing so, so the server-side refreshes (pages, every API poll,
 * the tutor app under /gia-su) rarely meet an expired token and no longer race each other with
 * the same refresh token. Renders nothing.
 */
export function SessionKeeper() {
  useEffect(() => {
    // createBrowserClient is a singleton in the browser: this starts its auto-refresh once.
    void createClient().auth.getSession();
  }, []);
  return null;
}
