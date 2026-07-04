// Auth handoff (ADR-025 §2-4 in the alkahest repo): full-page redirect to the
// /widget-auth consent page → back here with a one-time code in the URL fragment →
// exchange it for a scoped 'widget' token (issues:create + maps:read, 30-day expiry).
// The token lives in localStorage; a leaked one can only file issues as this user.
import type { ResolvedConfig } from "./config";

const TOKEN_KEY = "alkahest.toolbar.token";
const ACTIVE_KEY = "alkahest.toolbar.on";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

// The toolbar ships to every visitor but renders for almost none: only when a token is
// already stored (a team member who signed in before) or the visitor explicitly turns it
// on with ?alkahest=on (persisted; ?alkahest=off clears).
export function isActivated(): boolean {
  const q = new URLSearchParams(location.search).get("alkahest");
  try {
    if (q === "on") localStorage.setItem(ACTIVE_KEY, "1");
    if (q === "off") {
      localStorage.removeItem(ACTIVE_KEY);
      clearToken();
    }
    return !!getToken() || localStorage.getItem(ACTIVE_KEY) === "1";
  } catch {
    return q === "on";
  }
}

export function signInUrl(cfg: ResolvedConfig): string {
  const u = new URL(cfg.webBase + "/widget-auth");
  u.searchParams.set("origin", location.origin);
  u.searchParams.set("redirect", location.href.split("#")[0]);
  return u.href;
}

// On load: if the consent page sent us back with #alkahest_code=…, exchange it and
// scrub the fragment from the URL/history.
export async function pickUpHandoffCode(cfg: ResolvedConfig): Promise<boolean> {
  const m = location.hash.match(/[#&]alkahest_code=([a-f0-9]+)/);
  if (!m) return false;
  history.replaceState(null, "", location.pathname + location.search);
  const res = await fetch(cfg.apiBase + "/widget-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: m[1] }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) {
    console.warn("[alkahest-toolbar] code exchange failed:", body.message || body.error);
    return false;
  }
  try {
    localStorage.setItem(TOKEN_KEY, body.token);
    localStorage.setItem(ACTIVE_KEY, "1");
  } catch {
    /* storage unavailable */
  }
  return true;
}
