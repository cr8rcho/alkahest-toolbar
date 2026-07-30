// The toolbar UI: a floating button (bottom-right) opening an issue form — a card on
// desktop, a bottom sheet on small screens. Vanilla DOM, no framework, `akt-` class
// namespace, and a theme that follows the HOST PAGE (its <html> `color-scheme`, with the OS
// preference as the fallback) so it sits quietly on any host page, dark or light.
import { ApiError, createIssue, currentRoute, listIssueMaps, type IssueMapOption } from "./api";
import { clearToken, deactivate, getToken, pickUpHandoffCode, signInUrl } from "./auth";
import type { ResolvedConfig } from "./config";

const CSS = `
/* The app's design tokens, copied by value (a widget can't import Tailwind/shadcn). Names mirror
   app/globals.css so a token change there is a one-line change here. Light is the default; the
   dark block below only redefines values. FONT: Inter first so a host that already loads it (our
   own app does) gets it — a widget must never download a webfont onto someone else's page. */
:host{--c-card:#fff;--c-ink:#08090a;--c-muted:#62666d;--c-input:#e8e9eb;--c-line:#e8e9eb;
      --c-primary:#08090a;--c-primary-ink:#fafafa;--c-danger:#eb5757;--c-brand:#6366f1;
      --c-font:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
.akt-btn{position:fixed;right:16px;bottom:16px;z-index:2147483000;width:48px;height:48px;border-radius:50%;border:none;cursor:grab;background:#6366f1;color:#fff;font-size:20px;line-height:1;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none;transition:transform .16s ease,background .16s ease,opacity .16s ease}
.akt-btn:hover{filter:brightness(1.1)}
.akt-btn.akt-dragging{cursor:grabbing;transform:scale(1.06)}
/* Armed: the button fades under the target (which sits above it) so the ✕ stays readable. */
.akt-btn.akt-armed{background:var(--c-danger);transform:scale(.7);opacity:.35;box-shadow:none}
.akt-btn.akt-gone{opacity:0;transform:scale(.6);pointer-events:none;transition:opacity .16s ease,transform .16s ease}
.akt-dismiss{position:fixed;left:50%;bottom:calc(26px + env(safe-area-inset-bottom,0px));z-index:2147483002;width:60px;height:60px;margin-left:-30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid rgba(24,24,27,.22);background:rgba(255,255,255,.7);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:#52525b;opacity:0;transform:translateY(14px) scale(.9);pointer-events:none;transition:opacity .18s ease,transform .18s cubic-bezier(.2,.8,.2,1),background .16s ease,border-color .16s ease,color .16s ease}
.akt-dismiss.akt-show{opacity:1;transform:translateY(0) scale(1)}
.akt-dismiss.akt-armed{transform:translateY(0) scale(1.18);background:rgba(235,87,87,.12);border-color:var(--c-danger);color:var(--c-danger)}
.akt-dismiss svg{width:22px;height:22px}
.akt-dismiss-label{position:absolute;left:50%;top:-24px;transform:translateX(-50%);white-space:nowrap;font:600 11px/1 var(--c-font);letter-spacing:.04em;color:var(--c-muted)}
.akt-dismiss.akt-armed .akt-dismiss-label{color:var(--c-danger)}
.akt-panel{position:fixed;right:16px;bottom:76px;z-index:2147483001;width:340px;max-width:calc(100vw - 32px);border-radius:12px;background:var(--c-card);color:var(--c-ink);border:1px solid var(--c-line);box-shadow:0 12px 32px rgba(0,0,0,.25);font:14px/1.5 var(--c-font);display:flex;flex-direction:column;overflow:hidden}
/* 14px/700 = the viewer issue panel's own panel heading (viewer-issues.tsx CreateForm), not the
   dialog's 16px/500 — this is a floating panel, so it follows the panel idiom throughout. */
.akt-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--c-line);font-weight:700}
/* 32px box around a 16px glyph, pulled back by the negative margin so the head keeps its
   height — the ✕ used to be a 24x22 target, which is a miss waiting to happen on a phone. */
.akt-x{border:none;background:none;cursor:pointer;font-size:16px;color:inherit;opacity:.6;padding:0;width:32px;height:32px;margin:-6px -8px -6px 0;display:flex;align-items:center;justify-content:center;flex:none}
.akt-x:hover{opacity:1}
/* 16px between fields / 4px label-to-control = the panel's mt-4 + mb-1 ramp (issue-fields.tsx,
   lifted from Atlassian form spacing there). */
.akt-body{padding:14px;display:flex;flex-direction:column;gap:16px}
.akt-body label{display:flex;flex-direction:column;gap:4px}
/* SECTION_LABEL: 12px uppercase tracking-wide muted, weight inherited (400). The text lives in a
   span, NOT on the <label> — the label wraps its control, so a font-size/text-transform/colour on
   it would cascade straight into the input's own text. */
.akt-lab{font-size:12px;text-transform:uppercase;letter-spacing:.025em;color:var(--c-muted)}
/* shadcn Input/Textarea metrics: h-8 + px-3, min-h-14 + px-2.5 py-2. Explicit font-size (not
   font:inherit) so the label span's 12px can never leak in. */
.akt-body input,.akt-body textarea,.akt-body select{box-sizing:border-box;font-family:inherit;font-size:14px;text-transform:none;letter-spacing:normal;color:var(--c-ink);background:transparent;border:1px solid var(--c-input);border-radius:8px;outline:none}
.akt-body input,.akt-body select{height:32px;padding:0 12px}
.akt-body textarea{resize:vertical;min-height:56px;padding:8px 10px}
/* focus-visible's signature in this system is border + a 3px ring at 50% brand (ring-3). */
.akt-body input:focus,.akt-body textarea:focus,.akt-body select:focus{border-color:var(--c-brand);box-shadow:0 0 0 3px rgb(99 102 241 / .5)}
/* Neutral, like every other primary button in the product: the indigo brand is an accent (rings,
   status dots, and the bubble itself), never a button fill. */
.akt-submit{box-sizing:border-box;border:none;border-radius:8px;padding:0 14px;height:32px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;background:var(--c-primary);color:var(--c-primary-ink)}
.akt-submit:disabled{opacity:.5;cursor:default}
.akt-muted{color:var(--c-muted);margin:0}
.akt-err{color:var(--c-danger);margin:0}
.akt-route{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--c-muted);background:color-mix(in srgb,var(--c-muted) 10%,transparent);border-radius:6px;padding:4px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.akt-row{display:flex;gap:8px}
.akt-row button{flex:1}
.akt-ghost{box-sizing:border-box;border:1px solid var(--c-input);border-radius:8px;padding:0 14px;height:32px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;background:transparent;color:inherit}
.akt-danger{background:var(--c-danger)}
/* Phone: a bottom sheet, 16px fields, thumb-sized buttons.
   The 16px is not a taste call — iOS Safari zooms the whole page when a focused field is under
   16px, and a widget cannot stop that: the switch is the HOST page's viewport meta
   (maximum-scale=1), which only the host may set. We could inject it and silently kill
   pinch-zoom for their whole page; we don't.
   The field HEIGHT is a taste call, and 44px was too tall: it made the widget's fields read as a
   different product's next to the app's own 32px issue fields. 38px carries the same 16px text
   with 6px of air, halving that gap (12px -> 6px). Tap difficulty is unchanged — the 44px
   guideline is about small buttons, and a full-width 358x38 field is ~6.7x that recommended area.
   Buttons stay 46px: a mis-tap there actually costs something. */
@media (max-width:480px){
.akt-panel{left:0;right:0;bottom:0;width:auto;max-width:none;border-radius:16px 16px 0 0;padding-bottom:env(safe-area-inset-bottom,0px)}
.akt-body input,.akt-body textarea,.akt-body select{font-size:16px}
.akt-body input,.akt-body select{height:38px;padding:0 12px}
.akt-body textarea{min-height:88px;padding:9px 12px}
.akt-submit,.akt-ghost{height:46px;padding:0 16px;font-size:15px}
.akt-x{width:40px;height:40px;margin:-10px -10px -10px 0}
}
/* Dark is keyed to a class on the shadow host, not prefers-color-scheme, because the OS is
   the wrong authority here: the toolbar sits INSIDE a page, and a site can be dark while the
   OS is light (alkahest.app itself defaults to dark). JS resolves which one to use — see
   resolveTheme() — and the OS preference is only the last fallback. color-scheme on the host
   makes the native bits inside the shadow tree (select popup, caret, scrollbars) follow too. */
:host(.akt-dark){color-scheme:dark;--c-card:#161718;--c-ink:#f7f8f8;--c-muted:#8a8f98;--c-input:#26282c;
                 --c-line:#23252a;--c-primary:#f7f8f8;--c-primary-ink:#08090a}
:host(.akt-dark) .akt-dismiss{background:rgba(24,24,27,.7);border-color:rgba(250,250,250,.24);color:#a1a1aa}
:host(.akt-dark) .akt-dismiss.akt-armed{background:rgba(248,113,113,.18);border-color:#f87171;color:#f87171}
:host(.akt-dark) .akt-dismiss-label{color:#a1a1aa}
:host(.akt-dark) .akt-dismiss.akt-armed .akt-dismiss-label{color:#f87171}
/* Keep the arm signal (color) under reduced motion — it's the only other cue there is. */
@media (prefers-reduced-motion:reduce){.akt-btn,.akt-dismiss{transition-property:background,border-color,color,opacity}}
`;

// Where the button rests: snapped to the left or right edge, at `bottom` px from the
// viewport bottom. Persisted per origin so the user's chosen spot survives reloads —
// the whole point is dodging the host app's own floating buttons.
const POS_KEY = "alkahest.toolbar.pos";
type ButtonPos = { side: "left" | "right"; bottom: number };
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

// Drag-to-dismiss (the Vercel-toolbar gesture): while dragging, a target circle rises at
// the bottom center; the drag arms when the button's center comes within ARM_RADIUS of it.
const ARM_RADIUS = 72;

export class Toolbar {
  private root: ShadowRoot;
  private host: HTMLDivElement;
  private panel: HTMLDivElement | null = null;
  private maps: IssueMapOption[] | null = null;
  private btn: HTMLButtonElement;
  private dismiss: HTMLDivElement;
  private pos: ButtonPos = { side: "right", bottom: 16 };
  private suppressClick = false;
  private pendingOff = false; // the confirm sheet was opened by a drop, so the button is hidden
  private theme: "light" | "dark" | null = null;
  private themeWatch: MutationObserver | null = null;
  private onResize = () => this.applyPos();
  // The keyboard opening/closing is a visual-viewport event, not a window resize.
  private onViewport = () => { if (this.panel) this.placePanel(); };
  private onScheme = () => this.applyTheme();

  constructor(private cfg: ResolvedConfig) {
    // Shadow DOM keeps host-page CSS out of the toolbar and vice versa.
    const host = (this.host = document.createElement("div"));
    host.setAttribute("data-alkahest-toolbar", "");
    this.root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    this.root.appendChild(style);
    const btn = (this.btn = document.createElement("button"));
    btn.className = "akt-btn";
    btn.title = "File an Alkahest issue (drag to move, drop at the bottom to turn off)";
    btn.textContent = "◈";
    btn.addEventListener("click", () => {
      // A drag ends in a click on the same element — swallow it so releasing doesn't open.
      if (this.suppressClick) { this.suppressClick = false; return; }
      this.toggle();
    });
    this.root.appendChild(btn);

    const dismiss = (this.dismiss = document.createElement("div"));
    dismiss.className = "akt-dismiss";
    dismiss.setAttribute("aria-hidden", "true");
    dismiss.innerHTML =
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">` +
      `<path d="M6 6l12 12M18 6L6 18"/></svg><span class="akt-dismiss-label">Drop to turn off</span>`;
    this.root.appendChild(dismiss);

    document.body.appendChild(host);

    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || "");
      if (saved && (saved.side === "left" || saved.side === "right") && typeof saved.bottom === "number") this.pos = saved;
    } catch { /* default resting spot */ }
    this.applyPos();
    window.addEventListener("resize", this.onResize);
    window.visualViewport?.addEventListener("resize", this.onViewport);
    window.visualViewport?.addEventListener("scroll", this.onViewport);
    // Follow the host page's theme live: a site toggle changes an attribute on <html> (a
    // class, a data-theme, or an inline color-scheme), so watch those and re-resolve. The
    // media-query listener covers the OS-preference fallback.
    this.applyTheme();
    this.themeWatch = new MutationObserver(this.onScheme);
    // <html> AND <body>: sites put their theme switch on either one (Tailwind's `.dark`, a
    // `data-theme`, an inline `color-scheme`), and the luminance step reads body's background.
    for (const el of [document.documentElement, document.body]) {
      if (el) this.themeWatch.observe(el, { attributes: true, attributeFilter: ["style", "class", "data-theme"] });
    }
    window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", this.onScheme);
    this.wireDrag();
  }

  // Which theme to wear. The host PAGE decides, not the OS — a widget that reads only
  // `prefers-color-scheme` glows white on a dark site whose visitor keeps a light OS.
  // In order:
  //   1. an explicit `theme` in the config (`data-theme` on the script tag) — for sites whose
  //      CSS declares nothing readable,
  //   2. the root element's computed `color-scheme`: the standard declaration a themed site
  //      already makes (alkahest.app writes it inline on <html> when the theme flips),
  //   3. the page's own background luminance — plenty of sites do dark mode with just a
  //      `.dark` class and never declare `color-scheme`, and against those the toolbar has to
  //      read the pixels it is sitting on rather than trust the OS,
  //   4. the OS preference, for pages that say nothing and paint nothing (transparent bg).
  private resolveTheme(): "light" | "dark" {
    if (this.cfg.theme === "dark" || this.cfg.theme === "light") return this.cfg.theme;
    const cs = getComputedStyle(document.documentElement).colorScheme || "";
    const dark = /\bdark\b/.test(cs), light = /\blight\b/.test(cs);
    if (dark !== light) return dark ? "dark" : "light"; // exactly one → the page committed
    const lum = pageLuminance();
    if (lum !== null) return lum < 0.4 ? "dark" : "light";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  private applyTheme() {
    const t = this.resolveTheme();
    if (t === this.theme) return;
    this.theme = t;
    this.host.classList.toggle("akt-dark", t === "dark");
  }

  // Snap the button to its resting spot (edge + bottom offset), re-clamped to the viewport.
  private applyPos() {
    this.pos.bottom = clamp(this.pos.bottom, 8, window.innerHeight - 64);
    const b = this.btn.style;
    b.top = "auto";
    b.bottom = this.pos.bottom + "px";
    b.left = this.pos.side === "left" ? "16px" : "auto";
    b.right = this.pos.side === "right" ? "16px" : "auto";
    if (this.panel) this.placePanel();
  }

  // Drag to move (chat-head style): free while dragging, snaps to the nearer left/right
  // edge on release. A <6px movement counts as a tap (the click handler runs toggle()).
  // Dropping onto the bottom-center target instead asks to turn the toolbar off.
  private wireDrag() {
    const btn = this.btn;
    let sx = 0, sy = 0, startLeft = 0, startTop = 0, dragging = false, armed = false;
    btn.addEventListener("pointerdown", (e) => {
      if (this.pendingOff) return; // the confirm sheet owns the button right now
      // Clear the drag's click-swallow flag at the START of every gesture. A mouse drag ends
      // in a click, which consumed the flag; a TOUCH drag ends without one, so the flag set
      // by the previous drag was still up and ate the next tap — the button needed two taps
      // to open the panel after any drag on a phone.
      this.suppressClick = false;
      sx = e.clientX; sy = e.clientY;
      const r = btn.getBoundingClientRect();
      startLeft = r.left; startTop = r.top;
      dragging = false; armed = false;
      btn.setPointerCapture(e.pointerId);
    });
    btn.addEventListener("pointermove", (e) => {
      if (!btn.hasPointerCapture(e.pointerId)) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!dragging && Math.hypot(dx, dy) < 6) return;
      if (!dragging) {
        dragging = true;
        btn.classList.add("akt-dragging");
        this.dismiss.classList.add("akt-show");
      }
      const s = btn.style;
      s.left = clamp(startLeft + dx, 8, window.innerWidth - 56) + "px";
      s.top = clamp(startTop + dy, 8, window.innerHeight - 56) + "px";
      s.right = "auto"; s.bottom = "auto";

      // Arm on proximity only — no magnetic snap, so the button never drifts off the finger.
      const b = btn.getBoundingClientRect(), t = this.dismiss.getBoundingClientRect();
      const near = Math.hypot(
        b.left + b.width / 2 - (t.left + t.width / 2),
        b.top + b.height / 2 - (t.top + t.height / 2),
      ) < ARM_RADIUS;
      if (near === armed) return;
      armed = near;
      btn.classList.toggle("akt-armed", armed);
      this.dismiss.classList.toggle("akt-armed", armed);
      this.dismiss.querySelector(".akt-dismiss-label")!.textContent =
        armed ? "Release to turn off" : "Drop to turn off";
      if (armed) navigator.vibrate?.(8);
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      this.suppressClick = true;
      btn.classList.remove("akt-dragging", "akt-armed");
      this.dismiss.classList.remove("akt-show", "akt-armed");
      this.dismiss.querySelector(".akt-dismiss-label")!.textContent = "Drop to turn off";
      if (armed) {
        armed = false;
        // Don't record where it was dropped — the resting spot only changes on a real move.
        this.applyPos();
        this.askOff();
        return;
      }
      const r = btn.getBoundingClientRect();
      this.pos = {
        side: r.left + r.width / 2 < window.innerWidth / 2 ? "left" : "right",
        bottom: clamp(window.innerHeight - r.bottom, 8, window.innerHeight - 64),
      };
      try { localStorage.setItem(POS_KEY, JSON.stringify(this.pos)); } catch { /* ignore */ }
      this.applyPos();
    };
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointercancel", end);
  }

  // Dropped on the target: hide the button (it reads as "gone" while the sheet decides its
  // fate) and open the same confirmation the panel's footer link uses.
  private askOff() {
    this.pendingOff = true;
    this.btn.classList.add("akt-gone");
    if (!this.panel) {
      this.panel = document.createElement("div");
      this.panel.className = "akt-panel";
      this.root.appendChild(this.panel);
      this.placePanel();
    }
    this.confirmOff();
  }

  // The software keyboard's height, as the visual viewport reports it. iOS does NOT move
  // `position:fixed` elements when the keyboard opens — it only shrinks the visual viewport —
  // so a bottom sheet keeps sitting UNDER the keyboard exactly while its form is being filled
  // (Details and File issue were the parts that went missing). Same visual-viewport trick the
  // Alkahest web app uses to size its dialogs.
  private keyboardInset(): number {
    const vv = window.visualViewport;
    if (!vv) return 0;
    return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  }

  // Desktop: the panel opens adjacent to the button (same edge, just above it). Mobile
  // (≤480px) keeps the full-width bottom sheet — the CSS media query owns its box, so only
  // the keyboard lift is set inline there.
  private placePanel() {
    const p = this.panel!.style;
    if (!window.matchMedia("(min-width: 481px)").matches) {
      p.left = p.right = "";
      p.bottom = this.keyboardInset() + "px";
      return;
    }
    p.bottom = clamp(this.pos.bottom + 60, 16, window.innerHeight - 220) + "px";
    p.left = this.pos.side === "left" ? "16px" : "auto";
    p.right = this.pos.side === "right" ? "16px" : "auto";
  }

  private toggle() {
    if (this.panel) return this.close();
    this.panel = document.createElement("div");
    this.panel.className = "akt-panel";
    this.root.appendChild(this.panel);
    this.placePanel();
    this.render();
  }

  private close() {
    this.panel?.remove();
    this.panel = null;
    this.keepOn();
  }

  // Whatever ends the confirmation short of turning off brings the button back.
  private keepOn() {
    if (!this.pendingOff) return;
    this.pendingOff = false;
    this.btn.classList.remove("akt-gone");
  }

  // No footer escape hatch any more: the drag-to-dismiss gesture (2026-07-29) is the way
  // off, so a permanent "Turn off toolbar" line in every panel was a second door to the
  // same room, sitting under a form people use daily. `?alkahest=off` remains the typed
  // fallback, and the bubble's own tooltip names the gesture.
  private frame(bodyHtml: string, title = "File an issue"): HTMLDivElement {
    const p = this.panel!;
    p.innerHTML = `
      <div class="akt-head"><span>${esc(title)}</span><button class="akt-x" aria-label="Close">✕</button></div>
      <div class="akt-body">${bodyHtml}</div>`;
    p.querySelector(".akt-x")!.addEventListener("click", () => this.close());
    return p.querySelector(".akt-body") as HTMLDivElement;
  }

  // Two-step: turning it off also signs this browser out, and re-enabling needs a URL
  // the visitor may not have handy — so say both before doing it.
  private confirmOff() {
    const body = this.frame(`
      <p class="akt-muted">Hide the toolbar on this browser and sign out of it. To bring it back, open this site with <b>?alkahest=on</b>.</p>
      <div class="akt-row">
        <button class="akt-ghost">Cancel</button>
        <button class="akt-submit akt-danger">Turn off</button>
      </div>`, "Turn off toolbar");
    // Cancelling a drop puts things back the way they were (button visible, no panel);
    // cancelling the footer link just returns to the form.
    body.querySelector(".akt-ghost")!.addEventListener("click", () => {
      if (this.pendingOff) return this.close();
      this.render();
    });
    body.querySelector(".akt-submit")!.addEventListener("click", () => {
      deactivate();
      this.destroy();
    });
  }

  // Full teardown: the toolbar disappears without a reload.
  private destroy() {
    this.close();
    window.removeEventListener("resize", this.onResize);
    window.visualViewport?.removeEventListener("resize", this.onViewport);
    window.visualViewport?.removeEventListener("scroll", this.onViewport);
    this.themeWatch?.disconnect();
    window.matchMedia?.("(prefers-color-scheme: dark)").removeEventListener?.("change", this.onScheme);
    this.host.remove();
  }

  private async render() {
    // A consent code can arrive AFTER the script's init-time pickup: on an SPA host, the
    // return from /widget-auth is a soft (client-router) navigation, so the page never
    // reloads and init never re-runs. Re-check the fragment whenever the panel opens.
    if (!getToken() && /[#&]alkahest_code=/.test(location.hash)) {
      this.frame(`<p class="akt-muted">Signing in…</p>`);
      await pickUpHandoffCode(this.cfg).catch(() => false);
      if (!this.panel) return; // closed while exchanging
    }
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
      ${pickable ? `<label><span class="akt-lab">Issue map</span><select>${this.maps!.map((m) => `<option value="${esc(m.slug)}">${esc(m.name || m.slug)}</option>`).join("")}</select></label>` : ""}
      <label><span class="akt-lab">Title</span><input maxlength="200" placeholder="What's wrong?"></label>
      <label><span class="akt-lab">Description</span><textarea placeholder="What did you expect? What happened?"></textarea></label>
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

// The luminance of whatever the page actually painted behind us: body first, then <html>
// (body is transparent on plenty of sites). Returns null when neither paints anything opaque,
// which is the one case where the OS preference is the best guess left. Best effort by design
// — a background image or gradient reads as its base color, and that is fine: the toolbar only
// needs to know whether it is sitting on something dark.
function pageLuminance(): number | null {
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue;
    const m = /^rgba?\(([^)]+)\)$/.exec(getComputedStyle(el).backgroundColor || "");
    if (!m) continue;
    const [r, g, b, a = 1] = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (![r, g, b].every((v) => Number.isFinite(v)) || a < 0.5) continue; // see-through, keep looking
    // Rec. 601 luma is plenty for a light/dark decision and needs no gamma work.
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  return null;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
