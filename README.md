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
- Light/dark via `prefers-color-scheme`

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

> **SPA note:** the toolbar reads the activation flag and the returning consent code both
> at load and when the panel opens, so client-router navigations that rewrite the URL
> don't strand either. If your app normalizes the query string on boot, make sure it
> preserves params it doesn't own — otherwise `?alkahest=on` can be erased before any
> lazy-loaded script sees it.

## The button

- **Drag to move** (chat-head style): grab the ◈ button and drop it anywhere — it snaps
  to the nearer left/right screen edge and remembers the spot per origin, so it can stay
  clear of your app's own floating buttons. A tap (< 6 px movement) opens the panel; a
  drag never does.
- The panel opens next to the button's resting spot on desktop, and as a full-width
  bottom sheet on small screens (≤ 480 px).

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
