# Alkahest Toolbar

Embeddable issue-reporting toolbar for [Alkahest](https://alkahest.app) projects. A small
button in the corner of **your running product** lets your team file issues into your
project's issue maps — anchored to the page they were standing on — without leaving the
app. Mobile-first: works from a phone browser, where most real-usage friction is found.

**Team-only by design.** The toolbar ships to every visitor but renders for almost none:
it appears only after a team member signs in with their own Alkahest account (or flips it
on with `?alkahest=on`). Regular visitors see nothing. There is no anonymous feedback
mode and no secret key in your page source — the only thing you embed is your project's
public slug.

## Install

Script tag (auto-initializes):

```html
<script
  src="https://unpkg.com/@cr8rcho/alkahest-toolbar/dist/toolbar.global.js"
  data-alkahest-project="your-project-slug"
  defer
></script>
```

Or as a module:

```js
import { init } from "@cr8rcho/alkahest-toolbar";

init({
  project: "your-project-slug", // required — the :slug in alkahest.app/p/:slug
  issueMap: "bugs",             // optional — pin one issue map; omit to let the
                                // server resolve (sole map) or show a picker
});
```

## How it works

1. A team member taps the button → **Sign in with Alkahest** → full-page redirect to the
   consent screen on alkahest.app (no popups — mobile Safari can't be trusted with them).
2. Approving returns a one-time code in the URL fragment, which the toolbar exchanges for
   a **scoped token**: it can create issues and list maps, nothing else, and it expires
   in 30 days. It's visible (and revocable) on the account Tokens page as
   `widget: <your origin>`.
3. Filing an issue records the current route as the issue's `route` target — a fact, not
   a guess. Matching the route to a code-map node happens later, at triage, by people
   looking at the map.

## Activation & visibility

- Visitors with a stored token see the button. Everyone else sees nothing.
- `?alkahest=on` shows the button without a token (to reach the sign-in flow);
  `?alkahest=off` hides it again and clears the stored token.

## CSP

If your site sets a Content-Security-Policy, allow the Alkahest API host in `connect-src`
(and the CDN you load the script from in `script-src`).

## License

MIT
