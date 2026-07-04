// Toolbar configuration. `project` is the only required field — it's the public
// project slug already visible in /p/:slug URLs, so shipping it in page source
// leaks nothing. Auth is per-user (scoped widget token via /widget-auth), never
// a secret baked into the page.
export interface ToolbarConfig {
  /** Alkahest project slug (the `:slug` in alkahest.app/p/:slug). Required. */
  project: string;
  /** Issue map slug to file into. Omit → server resolves the sole issue map. */
  issueMap?: string;
  /** Supabase edge-functions base. Override for self-hosted backends. */
  apiBase?: string;
  /** Alkahest web app base (consent page lives there). */
  webBase?: string;
}

export interface ResolvedConfig extends Required<Omit<ToolbarConfig, "issueMap">> {
  issueMap: string | null;
}

export const DEFAULTS = {
  apiBase: "https://ytcmzkrvtomtcrcyqqcb.supabase.co/functions/v1",
  webBase: "https://alkahest.app",
};

export function resolveConfig(cfg: ToolbarConfig): ResolvedConfig {
  if (!cfg || typeof cfg.project !== "string" || !cfg.project.trim()) {
    throw new Error("[alkahest-toolbar] init requires a project slug.");
  }
  return {
    project: cfg.project.trim(),
    issueMap: cfg.issueMap?.trim() || null,
    apiBase: (cfg.apiBase || DEFAULTS.apiBase).replace(/\/+$/, ""),
    webBase: (cfg.webBase || DEFAULTS.webBase).replace(/\/+$/, ""),
  };
}
