// Thin client for the two endpoints the widget scope allows: GET /maps (list issue
// maps for the picker) and POST /issues-post (create the issue). Location is recorded
// as FACTS only — target_kind:'route' with the current pathname; matching a route to a
// code-map node happens later, at triage, by people who know the map.
import type { ResolvedConfig } from "./config";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call(cfg: ResolvedConfig, token: string, path: string, init?: RequestInit) {
  const res = await fetch(cfg.apiBase + path, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error || String(res.status), body.message || body.error || "Request failed");
  return body;
}

export interface IssueMapOption {
  slug: string;
  name: string | null;
}

export async function listIssueMaps(cfg: ResolvedConfig, token: string): Promise<IssueMapOption[]> {
  const body = await call(cfg, token, `/maps?slug=${encodeURIComponent(cfg.project)}&type=issue`);
  return (body.maps ?? [])
    .filter((m: { archived_at: string | null }) => !m.archived_at)
    .map((m: { slug: string; name: string | null }) => ({ slug: m.slug, name: m.name }));
}

export function currentRoute(): string {
  const p = location.pathname.replace(/\/+$/, "");
  return p || "/";
}

export async function createIssue(
  cfg: ResolvedConfig,
  token: string,
  input: { title: string; details: string; mapSlug: string | null },
): Promise<void> {
  const context = [
    "",
    "---",
    `Reported from: ${location.href}`,
    `User agent: ${navigator.userAgent}`,
  ].join("\n");
  await call(cfg, token, "/issues-post", {
    method: "POST",
    body: JSON.stringify({
      slug: cfg.project,
      title: input.title,
      body: (input.details ? input.details + "\n" : "") + context,
      target_kind: "route",
      target_key: currentRoute(),
      ...(input.mapSlug ? { mapSlug: input.mapSlug } : {}),
    }),
  });
}
