# DESIGN.md

PadosiPro take-home — architecture, decisions, trade-offs, and what comes next.

## Architecture

```
┌─────────────────────────────┐
│  Expo app (React Native)    │   Every screen native — no WebView.
│                             │   Tailwind via NativeWind.
│  SessionProvider            │   JWT in expo-secure-store (Keychain/Keystore)
│      │                      │
│      ├─ AuthFlow            │   Login · Register · Verify (6-box OTP)
│      └─ SignedInApp         │   Profile → Task selection → Home
│             │               │
│         api/client.ts       │   one fetch wrapper · zod-narrowed responses
└─────────────┼───────────────┘
              │ HTTPS, Bearer <jwt>
              ▼
┌─────────────────────────────┐
│  Express 5 API              │
│                             │
│  middleware/  auth · rateLimit · errorHandler   (one error shape)
│  routes/      thin: parse with zod, call a service, respond
│  services/    pure rules, take `now: Date` — no clock, no I/O
│  repositories/  the only place Prisma is touched
└──────┬───────────────────┬──┘
       │ Prisma 7          │ REST (server-side only)
       │ @prisma/adapter-pg│
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│ PostgreSQL   │    │  EmailJS     │  OTP delivery
│ Supabase or  │    │  (or console │  keys never leave the server
│ local Docker │    │   driver)    │
└──────────────┘    └──────────────┘
```

The app only ever talks to our API. Every third-party credential — database, EmailJS — lives on the
server, so nothing secret ships inside the bundle.

The layering is the part I would defend hardest: **rules are pure functions that take `now: Date`.**
`services/otp.ts` holds expiry, attempt limits and cooldown with no database and no clock, which is
why those tests need no fakes and run in milliseconds.

## Data model

```
users                         email_otps  (one row per user, replaced on resend)
  id            uuid pk         user_id     uuid pk → users.id  ON DELETE CASCADE
  email         text unique     code_hash   text        HMAC-SHA256(code, OTP_PEPPER)
                CHECK lower     expires_at  timestamptz
  password_hash text            attempts    int default 0
  is_verified   bool            last_sent_at timestamptz
  token_version int default 0   consumed_at timestamptz null
  created_at    timestamptz

profiles                      task_categories        tasks
  user_id uuid pk → users       id        serial pk    id          serial pk
  full_name    text             name      text unique  category_id → task_categories
  mobile       text             sort_order int         name        text
    CHECK ~ '^\+91[0-9]{10}$'                          description text
  address      text                                    UNIQUE (category_id, name)
  business_name text null
  updated_at   timestamptz     user_tasks
                                 user_id  → users   ON DELETE CASCADE
                                 task_id  → tasks   ON DELETE CASCADE
                                 created_at
                                 PRIMARY KEY (user_id, task_id)
```

Seeded: **6 categories, 28 tasks** (the brief asks for 4 and 20).

Two choices worth naming. **One OTP row per user, replaced on resend** rather than an append-only
log: there is only ever one live code, so "is this code valid" is a single lookup and expiry cannot
be ambiguous. **`user_tasks` has a composite primary key** and selection is replaced inside one
transaction, so a half-applied change can never leave someone looking at tasks they did not pick.

Constraints live in the database as well as in zod. `email = lower(email)` and the `+91` mobile
pattern are CHECK constraints appended by hand to the generated migration, because Prisma's schema
language cannot express them. They hold even if a bug bypasses the API layer.

## Auth and OTP decisions

| Decision | Why |
| --- | --- |
| **OTP stored as `HMAC-SHA256(code, OTP_PEPPER)`** | Six digits is a million possibilities — a plain hash of a leaked `email_otps` table falls in milliseconds. The pepper is a server-side secret held outside the database, so a database leak alone is not enough. Compared with `timingSafeEqual`. |
| **`token_version` on `users`, carried in the JWT as `tv`** | Logout must actually invalidate a token. A stateless JWT cannot be recalled, and a blocklist table means a database read per request forever. Bumping an integer invalidates every token issued before it, and the check rides along with the user lookup auth already does. |
| **Auto-login after verifying the OTP** | Verifying proves both possession of the email and knowledge of the password — the same two facts login checks, moments earlier. Sending a freshly verified user to a login form to retype what they just typed is friction with no security gain, so `/verify-otp` returns a token directly. |
| **Business Name optional** | Most PadosiPro customers are households, not businesses. Requiring it would make every family invent a value, which produces worse data than an honest null. Absence is a real answer. Sending it empty on a `PUT` clears a stored one, so the saved profile always matches the submitted form. |
| **bcrypt cost 12, and an unknown email still burns a comparison** | Without the decoy hash, an unknown address returns noticeably faster than a wrong password and login becomes an account-enumeration oracle. An integration test asserts the two responses are byte-identical. |
| **One OTP failure vocabulary** | `OTP_INVALID` (with `attemptsLeft`), `OTP_EXPIRED`, `OTP_LOCKED`, `OTP_ALREADY_USED`. A consumed or locked code is reported before the code is even compared, so a used code never reads as merely wrong. |
| **Every input parsed with zod at the boundary** | Bodies, params and environment. Handlers receive typed data and never re-check. The env schema means a misconfigured server fails at boot with a message naming each bad variable, instead of at 3am on the first OTP. |
| **Single error shape** `{ error: { code, message, fields?, details? } }` | The app branches on `code`, shows `message`, puts `fields` under the right input and acts on `details` (`attemptsLeft`, `retryAfterSeconds`). No per-endpoint error parsing anywhere in the client. |

Client-side validation messages are copied **verbatim** from the server's zod schemas, so a rule
caught on the device and the same rule caught on the server read identically.

## Trade-offs

**EmailJS instead of SMTP or a mail catcher.** The brief suggests SMTP or Mailpit. EmailJS needs no
SMTP credentials, no container, and no inbox to check, and its REST call is one `fetch` — which
kept `docker compose up` as the only command a reviewer needs. The costs are real: it is a
browser-oriented product, so server-side calls must be explicitly enabled in the account (a setting
people miss, and the most common reason mail silently fails); there is no local capture; and the
free tier is rate limited. This is why the mailer sits behind a two-line `Mailer` interface —
swapping in Nodemailer over SMTP is one new file and one enum value, no caller changes.

**Console driver as the default.** A reviewer with no email account can still complete the whole
flow by reading the code from `docker compose logs api`. The cost is a silent failure mode in
production: if a deployment forgets `MAIL_DRIVER=emailjs`, the API logs OTPs instead of mailing them
and returns success. That bit me once already. A startup guard refusing `console` when
`NODE_ENV=production` is on the list below.

**Supabase as plain Postgres.** Only a connection string, reached with Prisma 7 over
`@prisma/adapter-pg` — no `supabase-js`, no Supabase Auth, no RLS. Auth logic stays in our own code
where it is testable and explainable, the database stays swappable (the same code runs against local
Docker with one variable changed), and there is no second, parallel authorisation model to reason
about. The cost is writing session handling by hand — which is the substance of this assignment, so
that cost is the point.

**Prisma over hand-written SQL.** One schema file is the source of truth for both the database and
the TypeScript types, so a column rename is a compile error rather than a runtime one. The cost is a
heavy dependency and a query language to learn; the escape hatch is `$queryRaw` with tagged
templates, which parameterises values.

**No navigation library.** Three auth screens and three signed-in screens sit behind a discriminated
union in `App.tsx` and `SignedInApp.tsx`. React Navigation would add three native dependencies for
routing that is currently a `switch`. The moment a back stack or deep links are needed, that trade
flips.

**Rate limiting is skipped when `NODE_ENV=test`.** The integration suite drives far more than 30
auth calls from one address. The honest cost: the limiter itself is no longer covered by any test.

## What I left out

| Not built | Why, and what it would take |
| --- | --- |
| **Password reset** | Not in the brief, and it is a second full OTP journey — request, verify, set new password, plus bumping `token_version` to log out other devices. The OTP service already does everything except the new-password step. |
| **Refresh tokens** | A single 7-day access token is enough for a take-home. Production wants a short access token plus a rotating refresh token in secure storage, with reuse detection. `token_version` is the groundwork: it is already the revocation lever. |
| **Per-hour OTP send cap** | There is a 30-second per-user cooldown and a 30-request / 15-minute per-IP limit, but nothing stops a patient attacker requesting a code every 31 seconds for a day — which costs real money on a paid mail plan. Wants a per-address counter with an hourly ceiling, and the same for per-IP registrations. |
| **Mobile tests** | The backend has 64. The mobile app has none, and `mobile/src/profile/validation.ts` duplicates the server's rules — drift there is unguarded. A handful of pure-function tests would cover the real risk without a component-testing setup. |
| **Rate-limit tuning per route** | One limiter covers all of `/api/auth`. Login and OTP verification deserve tighter, separate budgets. |
| **iOS build** | Needs a paid Apple account; the brief says Android alone is fine. |
| **Observability** | `console.error` and nothing else. No structured logs, no request ids, no error tracking. |

## With another week

1. **Close the production footguns first** — refuse to boot on `MAIL_DRIVER=console` with
   `NODE_ENV=production`, and add the per-hour OTP cap. Both are small and both are real.
2. **Password reset**, reusing the OTP service end to end.
3. **Refresh tokens** with rotation and reuse detection, using `token_version` as the revocation
   lever that already exists.
4. **Mobile tests** for the validation mirror and the OTP countdown, plus one Detox run through
   register → verify → home.
5. **Profile editing after onboarding.** It is currently shown once and never again; `PUT /api/profile`
   already supports it, so this is a screen and a route in the shell.
6. **Structured logging with request ids**, so an OTP failure can be traced from device to mail
   provider.
7. **Polish against app.padosipro.com** — spacing, empty-state copy, and a real icon set in place of
   the placeholders.
