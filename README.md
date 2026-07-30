# Alkahest Toolbar

Embeddable issue-reporting toolbar for [Alkahest](https://alkahest.app) projects. A small
draggable button in the corner of **your running product** lets your team file issues into
your project's issue pool — anchored to the page they were standing on — without leaving
the app. Mobile-first: it's built for filing from a phone browser, where most real-usage
friction is actually found.

**Team-only by design.** The toolbar ships to every visitor but renders for almost none:
it appears only after a team member signs in with their own Alkahest account (or flips it
on with `?alkahest=on`). Regular visitors see nothing — no widget, no layout shift, no
network traffic beyond the script itself. There is no anonymous feedback mode and no
secret key in your page source: the only thing you embed is your project's public slug
(the same one already visible in your `alkahest.app/p/<slug>` URLs).

- Zero dependencies, framework-free vanilla TS
- ~10 kB minified IIFE (or an ESM build for bundlers)
- Shadow DOM — host-page CSS can't leak in, toolbar CSS can't leak out
- Light/dark **follows the host page** — its `<html>` `color-scheme`, else the page's own
  background, else the OS preference; pin it with `data-theme` if you'd rather decide

## Install

### Script tag (auto-initializes)

```html
<script
  src="https://unpkg.com/@cr8rcho/alkahest-toolbar/dist/toolbar.global.js"
  data-alkahest-project="your-project-slug"
  defer
></script>
```

Configuration rides on the same tag as data attributes:

| Attribute | Required | Meaning |
| --- | --- | --- |
| `data-alkahest-project` | ✓ | Project slug (the `:slug` in `alkahest.app/p/:slug`). Its presence is what triggers auto-init. |
| `data-issue-map` | | Issue-map slug to file into. Omit to let the server resolve the sole map, or to show a picker when the project has several. |
| `data-api-base` | | Override the Alkahest API base (self-hosted backends). |
| `data-web-base` | | Override the Alkahest web app base (where the consent page lives). |
| `data-theme` | | `auto` (default) / `light` / `dark`. Pin it when your site themes itself in a way the toolbar can't read — see [Theme](#theme). |

The IIFE also exposes `window.Alkahest.init(config)` if you'd rather init manually —
drop the `data-alkahest-project` attribute in that case so auto-init stays out of the way.

### Module

```bash
npm install @cr8rcho/alkahest-toolbar
```

```ts
import { init } from "@cr8rcho/alkahest-toolbar";

init({
  project: "your-project-slug", // required
  issueMap: "bugs",             // optional — pin one issue map
  // apiBase / webBase           // optional — self-hosted overrides
});
```

`init()` is idempotent (a second call is a no-op) and safe to run before
`DOMContentLoaded` — it defers mounting until the DOM is ready.

## How it works

1. **Sign in.** A team member taps the ◈ button → **Sign in with Alkahest** → full-page
   redirect to the consent screen on alkahest.app (no popups — mobile Safari can't be
   trusted with them). The consent screen names your site's origin and exactly what it's
   granting.
2. **Scoped token.** Approving returns a one-time code (5-minute TTL, single-use) in the
   URL fragment — it never reaches your server logs. The toolbar exchanges it for a
   **scoped token** that can create issues and list maps, *nothing else* — it cannot
   publish maps, read comments, or touch anything destructive — and it expires in
   30 days. It appears on the account **Tokens** page as `widget: <your origin>`, where
   it can be revoked at any time.
3. **File.** The form is title + details. The toolbar attaches the facts automatically:
   the current route becomes the issue's `route` target, and the full URL + user agent
   ride along in the body. A route is a fact, not a guess — matching it to a code-map
   node happens later, at triage (or automatically, when a published code map contains
   that route).
4. **Converge.** Once the project's code map is published with that route, Alkahest
   promotes the issue's target from a dashed *prospective* route to the solid node — and
   stamps the map version that shipped the fix when the issue is completed.

## Activation & visibility

The snippet is inert by default, so it's safe to ship on production:

- Visitors with a stored token see the button. Everyone else sees **nothing**.
- `?alkahest=on` (any page, any position in the query string) shows the button without a
  token — that's how a team member reaches the sign-in flow the first time. The flag
  persists in `localStorage`, so it's needed only once per browser.
- `?alkahest=off` hides the button again **and clears the stored token**.
- **Drag the button onto the ✕ target** at the bottom center of the screen — the target
  rises as soon as a drag starts, arms (red, larger) when the button comes within ~72 px of
  it, and dropping there opens the turn-off confirmation.
  Dropping is the way out from the UI: it confirms first (turning off also signs this browser
  out), then the toolbar unmounts on the spot. There used to be a **Turn off toolbar** link in
  every panel's footer as well; it's gone — one door to the same room is enough, and it sat
  under a form people use daily. `?alkahest=off` remains the typed fallback, which is also the
  only path that doesn't need a pointer.

> **SPA note:** the toolbar reads the activation flag and the returning consent code both
> at load and when the panel opens, so client-router navigations that rewrite the URL
> don't strand either. If your app normalizes the query string on boot, make sure it
> preserves params it doesn't own — otherwise `?alkahest=on` can be erased before any
> lazy-loaded script sees it.

## Theme

The toolbar lives inside *your* page, so the OS preference is the wrong authority: a dark site
visited from a light-mode laptop would get a glowing white panel. It resolves in this order and
re-resolves whenever `<html>`/`<body>` change their `class`, `style` or `data-theme`:

1. **`data-theme` on the script tag** (`light` / `dark`) — you decide, nothing is sniffed.
2. **`color-scheme` on `<html>`** — the standard declaration a themed site already makes. If
   you support dark mode, declaring it is worth doing anyway: it also fixes native form
   controls and scrollbars.
3. **The page's own background luminance** (`<body>`, then `<html>`) — for sites that theme with
   just a `.dark` class and never declare `color-scheme`.
4. **`prefers-color-scheme`** — only when the page declares nothing and paints nothing.

## The button

- **Drag to move** (chat-head style): grab the ◈ button and drop it anywhere — it snaps
  to the nearer left/right screen edge and remembers the spot per origin, so it can stay
  clear of your app's own floating buttons. A tap (< 6 px movement) opens the panel; a
  drag never does.
- **Drag to dismiss:** while dragging, a ✕ target appears at the bottom center. Dropping
  the button on it asks to turn the toolbar off (it doesn't turn off immediately — that
  also signs this browser out, so it confirms first). Cancelling puts the button back where
  it was; the drop position is never saved.
- The panel opens next to the button's resting spot on desktop (a 340 px card), and on a phone
  (≤ 480 px) it slides up and **fills the screen** — square corners, because it is the screen and
  not a card resting on one.

## One shell, four states

The panel is a single window whose contents change — it does not resize or re-shape between
states. Sign-in, the composer, the filed confirmation and the turn-off prompt all share the same
heading (the route), body and toolbar row; short states just centre their message. On a phone that
shell is the whole screen in every state; on desktop it is a fixed 340×272 card.

There is no loading state. The issue-map list is only needed to *draw* the picker — sending
without a map is fine, the server resolves the project's sole issue map — so the composer opens
immediately and the picker appears later if there turns out to be a choice.

Filing closes the panel by itself: the confirmation shows for 1.5s, then the toolbar gets out of
the way (instantly under `prefers-reduced-motion`).

## The composer

Filing an issue is a compose task, not a form to fill in, so the panel is written like one:

- **No boxes, no labels.** The first line is the **title** (bold), the block under it the
  **description** — the same two values as before, told apart by weight instead of by borders.
  Both carry `aria-label`s for assistive tech.
- **The route is the heading** — the one fact worth confirming before you send.
- **A toolbar row at the bottom** holds the issue-map picker (only when your project has more than
  one, and you didn't pin one) and the send control: a 36 px icon on a phone, a compact
  `File issue` button on desktop. It stays disabled until there is a title.
- **Enter on the title line** moves to the description; **⌘/Ctrl + Enter** sends from either
  field. The shortcut isn't printed on the button — it's in the button's tooltip.

## Security model

- **Nothing secret is embedded.** The project slug is public routing data.
- **Auth is per-user.** Every report is created as the signed-in Alkahest account, gated
  by that user's actual project permissions (editor access is required to file).
- **The stored token is scoped and expiring.** It lives in your site's `localStorage`, so
  an XSS on *your* site could read it — which is exactly why it can only create issues
  and list maps, and dies after 30 days. Revoke any time from the Tokens page.
- **The one-time code returns in the URL fragment**, not a query param — fragments are
  never sent to servers, so the code stays out of logs. It's single-use and expires in
  5 minutes regardless.

## CSP

If your site sets a Content-Security-Policy:

- `connect-src`: allow the Alkahest API host (default
  `https://ytcmzkrvtomtcrcyqqcb.supabase.co`)
- `script-src`: allow wherever you load the script from (CDN, or your own origin if you
  self-host the file)

The toolbar makes no other network requests and loads no remote assets.

## Development

```bash
npm install
npm run build       # dist/index.js (ESM) + dist/toolbar.global.js (IIFE) + .d.ts
npm run typecheck
```

Source layout: `src/config.ts` (options), `src/auth.ts` (activation + consent handoff +
token storage), `src/api.ts` (maps list / issue create), `src/panel.ts` (button + panel
UI), `src/index.ts` (public API), `src/global.ts` (IIFE entry).

This repo is the MIT half of Alkahest's open-core split: the SDK is open, while the
hosted service it talks to (consent page, token scoping, issue storage) lives in the
private `alkahest` repo.

## License

[MIT](./LICENSE)
