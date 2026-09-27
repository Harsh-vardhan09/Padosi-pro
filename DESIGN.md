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
| Prisma as the data layer, over a plain connection string | One schema file is the single source of truth for both the database and the TypeScript types, so a column rename is a compile error rather than a runtime one. Still no `supabase-js`: Prisma 7 talks to Postgres through the `@prisma/adapter-pg` driver adapter. |
| `prisma migrate deploy` + seed run in the container's start command | `docker compose up` stays the only command a reviewer needs, while migrations remain reviewable SQL files in git rather than an implicit `db push`. |
| Seed uses `upsert`, and runs on every boot | Re-running is safe and refreshes edited descriptions, so fixing catalogue copy needs no new migration. |
| Constraints in the database, not only in zod | `email = lower(email)` and `mobile ~ '^\+91[0-9]{10}$'` are appended by hand to the generated migration, because Prisma's schema language cannot express CHECK. Unique and composite keys come from the schema. They hold even if a bug bypasses the API layer. |
| Supabase reached through the **session pooler**, not the direct host | `db.<ref>.supabase.co` is IPv6-only and unreachable from an IPv4 network; the session pooler is IPv4 and, unlike the transaction pooler on 6543, keeps the prepared statements Prisma Migrate needs. |
| `token_version` on `users` | Lets logout-everywhere and password changes invalidate old JWTs without a token blocklist table. |
| OTP stored as a hash with a server-side `OTP_PEPPER` | A leaked `email_otps` table is not brute-forceable offline: 6 digits alone would fall in milliseconds. |
| `DB_SSL` toggle instead of sniffing the connection string | Supabase needs TLS, local Docker has none; one explicit flag beats guessing from the host name. |
| `MAIL_DRIVER=console` by default | A reviewer can complete the OTP flow from the server log without an EmailJS account. |
| Business rules are pure functions taking `now: Date` | `src/services/otp.ts` and `auth.ts` hold every rule (expiry, attempt limits, cooldown, login outcomes) with no clock, no database and no HTTP. That is why the OTP tests need no fakes and run in milliseconds. |
| Prisma access confined to `src/repositories/` | Routes and services stay readable and testable; swapping a query never touches a rule. |
| OTP stored as `HMAC-SHA256(code, OTP_PEPPER)`, compared with `timingSafeEqual` | The pepper means a leaked table is not brute-forceable offline, and the constant-time compare removes the byte-by-byte timing signal. |
| `token_version` bumped on logout | Logout kills every issued token with one integer, no blocklist table and no session store to clean up. |
| Unknown email still burns a bcrypt comparison | Without it, "no such user" returns in ~1ms while a wrong password takes ~300ms, which enumerates accounts. |
| Wrong password on an unverified account returns `INVALID_CREDENTIALS`, not `EMAIL_NOT_VERIFIED` | Otherwise the error itself confirms an address is registered. |
| bcryptjs rather than native `bcrypt` | Same algorithm and hash format, no node-gyp toolchain in the Alpine image or on Windows. Cost 12 keeps it ~300ms per hash. |
| `businessName` is optional | Most PadosiPro customers are households, not businesses. Making it required would force every family to invent one, turning a meaningful blank into junk data we could never trust. The reasoning sits next to the field in `src/routes/profile.ts`. |
| Mobile numbers normalised to `+91XXXXXXXXXX` on the way in | The app accepts whatever the user types; storage stays one canonical shape, so lookups and display never have to cope with four spellings of the same number. The DB `CHECK` enforces the stored shape. |
| Full names allow `\p{M}` as well as `\p{L}` | Indic vowel signs are combining marks, not letters, so a letters-only pattern rejects "आशा". A test caught this. |
| `PUT /api/me/tasks` replaces the selection in a transaction | A half-applied change would leave someone looking at tasks they never chose. Delete-then-insert in one transaction is simpler to reason about than diffing, and the selection is small. |
| Unknown task ids come back in `fields.taskIds`, not `details` | `details` is documented as flat scalars; a list of bad ids is genuinely a per-field validation message, so it belongs in `fields`. |
| A consumed code reports `OTP_ALREADY_USED` before `EMAIL_ALREADY_VERIFIED` | Re-submitting the code that just verified an account should say precisely that, which also keeps the single-use rule observable from the API. |
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
- [x] Auth / OTP flow, including expiry and retry limits
- [x] API reference (README)
- [ ] Mobile navigation and state
- [ ] Trade-offs and what I'd do with more time
