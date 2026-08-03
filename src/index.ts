// @cr8rcho/alkahest-toolbar — embeddable issue-reporting toolbar for Alkahest projects.
//
//   import { init } from "@cr8rcho/alkahest-toolbar";
//   init({ project: "my-project", issueMap: "bugs" });
//
// or as a script tag (auto-init from data attributes):
//
//   <script src=".../toolbar.global.js" data-alkahest-project="my-project" defer></script>
//
// Team-only by design: the button renders only for visitors with a stored widget token
// (or after explicit ?alkahest=on activation); everyone signs in with their own Alkahest
// account. Regular visitors see nothing.
import { isActivated, pickUpHandoffCode } from "./auth";
import { resolveConfig, type ToolbarConfig } from "./config";
import { hasDraft, Toolbar } from "./panel";

export type { ToolbarConfig };

let mounted = false;

export async function init(config: ToolbarConfig): Promise<void> {
  if (mounted) return;
  const cfg = resolveConfig(config);
  // Exchange a returning consent code BEFORE the activation check — a successful
  // exchange stores the token, which is itself the activation signal.
  const returned = await pickUpHandoffCode(cfg).catch(() => false);
  if (!isActivated()) return;
  mounted = true;
  // Someone who signed in mid-issue lands back on the page they were reporting: open the
  // composer for them rather than making them find the bubble again. Their text is already
  // in it — the draft store, not this, is what kept it.
  const mount = () => {
    const bar = new Toolbar(cfg);
    if (returned && hasDraft(cfg)) bar.open();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
}

// Script-tag entry: read config off the <script> element's data attributes.
export function autoInit(): void {
  const el = document.currentScript as HTMLScriptElement | null;
  const script = el ?? document.querySelector<HTMLScriptElement>("script[data-alkahest-project]");
  const project = script?.dataset.alkahestProject;
  if (!project) return;
  void init({
    project,
    issueMap: script?.dataset.issueMap,
    apiBase: script?.dataset.apiBase,
    webBase: script?.dataset.webBase,
    theme: script?.dataset.theme as "auto" | "light" | "dark" | undefined,
  });
}
