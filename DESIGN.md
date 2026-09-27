# DESIGN.md

_Placeholder — filled in as features land._

## Overview

PadosiPro is a lifestyle-management service. This repo holds the API and the
mobile client.

## Architecture

```
Expo app  ──HTTPS──>  Express API  ──pg──>  PostgreSQL (Supabase / local Docker)
                           │
                           └──REST──> EmailJS (OTP delivery)
```

The app only ever talks to our API. Third-party credentials (EmailJS, database)
live on the server, so nothing secret ships inside the bundle.

## Decisions so far

| Decision | Why |
| --- | --- |
| Supabase used as plain Postgres via a connection string | Keeps auth and data access in our own code; no client-side SDK or RLS to reason about. |
| OTP email sent server-side through the EmailJS REST API | The EmailJS private key stays on the server; a client-side send could be abused to spam. |
| zod validates every input, including env | One validation style for bodies, params, and configuration; parsing at the boundary means handlers work with typed data. |
| Single error shape `{ error: { code, message, fields? } }` | The app branches on `code`, shows `message`, and highlights `fields` — no per-endpoint error parsing. |
| Express app built by a factory with no side effects | Tests create an app without binding a port. |
| Tailwind in the app via NativeWind v5 | One styling vocabulary shared with the web world, compiled to real `StyleSheet` objects at build time. Still native views — no WebView. |
| Brand tokens in `mobile/global.css`, not a JS colours file | `@theme` makes `--color-primary` available as `text-primary` / `bg-primary`, so there is one source of truth instead of two. |

### Mobile setup notes worth explaining

- **`lightningcss` is pinned to `1.30.1`** in `mobile/package.json` `overrides`. Expo SDK 57 resolves
  `1.33.0`, which `react-native-css` (NativeWind's compiler) cannot talk to — every CSS build fails
  with `failed to deserialize; expected a sequence, found ()`. Remove the override once NativeWind v5
  ships support for it.
- **There is deliberately no `mobile/babel.config.js`.** Adding one makes Babel resolve Expo's whole
  preset chain from the project root, where SDK 57 does not hoist `babel-preset-expo` or
  `react-native-worklets/plugin`. Expo's default config already applies what NativeWind needs.
- `react-native-reanimated` is a direct dependency because `react-native-css` imports it eagerly for
  animated styles; Metro cannot resolve it otherwise.

## To document

- [ ] Data model and migrations
- [ ] Auth / OTP flow, including expiry and retry limits
- [ ] API reference
- [ ] Mobile navigation and state
- [ ] Trade-offs and what I'd do with more time
