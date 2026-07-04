// The toolbar UI: a floating button (bottom-right) opening an issue form — a card on
// desktop, a bottom sheet on small screens. Vanilla DOM, no framework, `akt-` class
// namespace, colors keyed to prefers-color-scheme so it sits quietly on any host page.
import { ApiError, createIssue, currentRoute, listIssueMaps, type IssueMapOption } from "./api";
import { clearToken, getToken, signInUrl } from "./auth";
import type { ResolvedConfig } from "./config";

const CSS = `
.akt-btn{position:fixed;right:16px;bottom:16px;z-index:2147483000;width:48px;height:48px;border-radius:50%;border:none;cursor:pointer;background:#6366f1;color:#fff;font-size:20px;line-height:1;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}
.akt-btn:hover{filter:brightness(1.1)}
.akt-panel{position:fixed;right:16px;bottom:76px;z-index:2147483001;width:340px;max-width:calc(100vw - 32px);border-radius:12px;background:#fff;color:#18181b;border:1px solid #e4e4e7;box-shadow:0 12px 32px rgba(0,0,0,.25);font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;flex-direction:column;overflow:hidden}
.akt-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #e4e4e7;font-weight:600}
.akt-x{border:none;background:none;cursor:pointer;font-size:16px;color:inherit;opacity:.6;padding:2px 6px}
.akt-x:hover{opacity:1}
.akt-body{padding:14px;display:flex;flex-direction:column;gap:10px}
.akt-body label{display:flex;flex-direction:column;gap:4px;font-weight:500}
.akt-body input,.akt-body textarea,.akt-body select{font:inherit;color:inherit;background:transparent;border:1px solid #d4d4d8;border-radius:8px;padding:7px 9px;outline:none}
.akt-body input:focus,.akt-body textarea:focus,.akt-body select:focus{border-color:#6366f1}
.akt-body textarea{resize:vertical;min-height:64px}
.akt-submit{border:none;border-radius:8px;padding:9px 12px;font:inherit;font-weight:600;cursor:pointer;background:#6366f1;color:#fff}
.akt-submit:disabled{opacity:.5;cursor:default}
.akt-muted{color:#71717a;margin:0}
.akt-err{color:#dc2626;margin:0}
.akt-route{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#71717a;background:rgba(113,113,122,.1);border-radius:6px;padding:4px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (max-width:480px){.akt-panel{left:0;right:0;bottom:0;width:auto;max-width:none;border-radius:16px 16px 0 0}}
@media (prefers-color-scheme:dark){.akt-panel{background:#18181b;color:#fafafa;border-color:#27272a}.akt-head{border-color:#27272a}.akt-body input,.akt-body textarea,.akt-body select{border-color:#3f3f46}}
`;

export class Toolbar {
  private root: ShadowRoot;
  private panel: HTMLDivElement | null = null;
  private maps: IssueMapOption[] | null = null;

  constructor(private cfg: ResolvedConfig) {
    // Shadow DOM keeps host-page CSS out of the toolbar and vice versa.
    const host = document.createElement("div");
    host.setAttribute("data-alkahest-toolbar", "");
    this.root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    this.root.appendChild(style);
    const btn = document.createElement("button");
    btn.className = "akt-btn";
    btn.title = "File an Alkahest issue";
    btn.textContent = "◈";
    btn.addEventListener("click", () => this.toggle());
    this.root.appendChild(btn);
    document.body.appendChild(host);
  }

  private toggle() {
    if (this.panel) return this.close();
    this.panel = document.createElement("div");
    this.panel.className = "akt-panel";
    this.root.appendChild(this.panel);
    this.render();
  }

  private close() {
    this.panel?.remove();
    this.panel = null;
  }

  private frame(bodyHtml: string): HTMLDivElement {
    const p = this.panel!;
    p.innerHTML = `
      <div class="akt-head"><span>File an issue</span><button class="akt-x" aria-label="Close">✕</button></div>
      <div class="akt-body">${bodyHtml}</div>`;
    p.querySelector(".akt-x")!.addEventListener("click", () => this.close());
    return p.querySelector(".akt-body") as HTMLDivElement;
  }

  private async render() {
    const token = getToken();
    if (!token) {
      const body = this.frame(`
        <p class="akt-muted">Sign in with your Alkahest account to file issues for <b>${esc(this.cfg.project)}</b> right from this page.</p>
        <button class="akt-submit">Sign in with Alkahest</button>`);
      body.querySelector("button")!.addEventListener("click", () => {
        location.href = signInUrl(this.cfg);
      });
      return;
    }

    // Map picker only when the developer didn't pin one AND the project has several.
    if (this.maps === null && !this.cfg.issueMap) {
      this.frame(`<p class="akt-muted">Loading…</p>`);
      try {
        this.maps = await listIssueMaps(this.cfg, token);
      } catch (e) {
        return this.fail(e);
      }
      if (!this.panel) return; // closed while loading
    }
    const pickable = !this.cfg.issueMap && (this.maps?.length ?? 0) > 1;

    const body = this.frame(`
      <div class="akt-route" title="Recorded as the issue's route target">${esc(currentRoute())}</div>
      ${pickable ? `<label>Issue map<select>${this.maps!.map((m) => `<option value="${esc(m.slug)}">${esc(m.name || m.slug)}</option>`).join("")}</select></label>` : ""}
      <label>Title<input maxlength="200" placeholder="What's wrong?"></label>
      <label>Details<textarea placeholder="What did you expect? What happened?"></textarea></label>
      <p class="akt-err" hidden></p>
      <button class="akt-submit">File issue</button>`);

    const err = body.querySelector(".akt-err") as HTMLParagraphElement;
    const submit = body.querySelector(".akt-submit") as HTMLButtonElement;
    submit.addEventListener("click", async () => {
      const title = (body.querySelector("input") as HTMLInputElement).value.trim();
      if (!title) {
        err.hidden = false;
        err.textContent = "A title is required.";
        return;
      }
      submit.disabled = true;
      err.hidden = true;
      try {
        await createIssue(this.cfg, token, {
          title,
          details: (body.querySelector("textarea") as HTMLTextAreaElement).value.trim(),
          mapSlug: this.cfg.issueMap ?? (body.querySelector("select") as HTMLSelectElement | null)?.value ?? null,
        });
        this.frame(`<p class="akt-muted">Issue filed. Thanks! It's now in <b>${esc(this.cfg.project)}</b>'s pool, anchored to <b>${esc(currentRoute())}</b>.</p>`);
      } catch (e) {
        this.fail(e, body, submit);
      }
    });
  }

  // Expired/revoked token → drop it and fall back to the sign-in state; other errors
  // surface inline (keeping the form) when we have one, else replace the panel body.
  private fail(e: unknown, body?: HTMLDivElement, submit?: HTMLButtonElement) {
    if (e instanceof ApiError && (e.code === "token_expired" || e.code === "invalid_token")) {
      clearToken();
      this.render();
      return;
    }
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    if (body && submit) {
      const err = body.querySelector(".akt-err") as HTMLParagraphElement;
      err.hidden = false;
      err.textContent = msg;
      submit.disabled = false;
    } else {
      this.frame(`<p class="akt-err">${esc(msg)}</p>`);
    }
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
