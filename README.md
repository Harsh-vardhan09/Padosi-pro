# PadosiPro

> You don't manage tasks — we do.

Take-home monorepo: an Express + PostgreSQL API and an Expo (React Native) app covering the first
user journey — register → verify email by OTP → login → profile → task selection → home.

```
backend/            Node.js + TypeScript + Express API (Prisma, PostgreSQL)
mobile/             Expo (React Native) + TypeScript app, Tailwind via NativeWind
docker-compose.yml  Postgres 16 + the API, for a one-command local run
DESIGN.md           Architecture, trade-offs, what was left out
ASSIGNMENT.md       The brief this repo answers
```

---

## 1. Prerequisites

| Tool | Minimum | Verified on | Needed for |
| --- | --- | --- | --- |
| Docker Desktop (with Compose v2) | 24 / Compose 2.20 | 29.6.2 / Compose 5.3.1 | The one-command backend. Nothing else required. |
| Node.js | 20 LTS | 26.5.0 | Running without Docker, the mobile app, tests |
| npm | 10 | 11.17.0 | ditto |
| Expo Go app (Android/iOS) | latest | — | Running the app on a physical phone |
| An Android emulator **or** a phone | — | — | Seeing the app |

Only Docker is needed for the API. Node is needed for the mobile app.

```bash
docker --version && docker compose version && node -v && npm -v
```

---

## 2. Backend in one command

```bash
docker compose up
```

That is the whole setup — no `.env` to write, no database to create, no email account.

- API: <http://localhost:4000>
- Health: `curl http://localhost:4000/health` → `{"ok":true}`
- Postgres: `localhost:5432` (user `padosi`, password `padosi`, db `padosipro`)

The container runs `prisma migrate deploy` and the seed before it listens, so the schema and the
**6 categories / 28 tasks** catalogue are ready the moment it reports healthy. The compose file
supplies throwaway local credentials, which is why they can live in git.

Stop with `Ctrl+C`. `docker compose down` removes the containers; add `-v` to drop the database
volume so the next `up` rebuilds from scratch.

**With the default `MAIL_DRIVER=console` no email account is needed** — the OTP is printed to the
API log. See [§6](#6-how-email-is-sent).

### Check it worked

```bash
curl http://localhost:4000/health
docker compose exec db psql -U padosi -d padosipro -c \
  "select c.name, count(t.id) from task_categories c
   left join tasks t on t.category_id=c.id group by c.id, c.name order by c.name;"
```

### End-to-end in one script

Walks register → verify → login → profile → task selection → logout, asserting all 24 steps:

```bash
./scripts/smoke-auth.sh
```

---

## 3. Using Supabase instead of Docker Postgres

Supabase is used as **plain PostgreSQL over a connection string** — no `supabase-js`, no Supabase
Auth, no RLS. Only `DATABASE_URL` and `DB_SSL` change.

1. Supabase dashboard → **Connect** → **Session pooler** → copy the URI. It looks like:

   ```
   postgres://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```

2. Put it in `backend/.env` with TLS on:

   ```bash
   cp backend/.env.example backend/.env
   # then edit:
   DATABASE_URL=postgres://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   DB_SSL=true
   ```

3. Apply the schema and seed, then run:

   ```bash
   cd backend
   npm install
   npm run prisma:deploy
   npm run db:seed
   npm run dev            # API on http://localhost:4000
   ```

**Use the session pooler, not the direct host.** `db.<ref>.supabase.co` is IPv6-only and fails with
`ENOTFOUND` on an IPv4 network. Avoid the *transaction* pooler (port 6543) too — it disables the
prepared statements Prisma Migrate needs.

---

## 4. Environment variables

Every variable the server reads is in [`backend/.env.example`](backend/.env.example) with a
one-line comment. Nothing real is ever committed. The server validates all of them with zod at boot
and refuses to start with a message naming each bad one.

| Variable | Default | What it is |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` \| `test` \| `production`. |
| `PORT` | `4000` | Port the API listens on. |
| `DATABASE_URL` | — | **Required.** Plain Postgres connection string — Docker or Supabase. |
| `DB_SSL` | `false` | `false` for local Docker, `true` for Supabase. Explicit rather than guessed from the host name. |
| `TEST_DATABASE_URL` | unset | Throwaway database for the integration tests. Unset → they skip. |
| `TEST_DB_SSL` | `false` | TLS for the test database only. `DB_SSL` is deliberately ignored during tests. |
| `JWT_SECRET` | — | **Required**, min 16 chars. Signing key. `openssl rand -base64 32`. |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime (`15m`, `24h`, `7d`). |
| `OTP_PEPPER` | — | **Required**, min 16 chars. Server-side secret mixed into the OTP hash. |
| `MAIL_DRIVER` | `console` | `console` logs the OTP; `emailjs` sends real mail. |
| `EMAILJS_SERVICE_ID` | — | Required when `MAIL_DRIVER=emailjs`. |
| `EMAILJS_TEMPLATE_ID` | — | ditto |
| `EMAILJS_PUBLIC_KEY` | — | ditto |
| `EMAILJS_PRIVATE_KEY` | — | ditto. Server-only; never reaches the app. |

Mobile has one, in [`mobile/.env.example`](mobile/.env.example):

| Variable | What it is |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Base URL of the API. **No trailing slash.** See [§5](#5-mobile-app). |

---

## 5. Mobile app

```bash
cd mobile
npm install
cp .env.example .env     # then set EXPO_PUBLIC_API_URL for your setup — see the table
npx expo start
```

Press `a` for an Android emulator, `i` for an iOS simulator, or scan the QR code with **Expo Go**.

### Pick the right API URL

`localhost` inside an emulator or phone means *that device*, not your machine. This is the single
most common reason the app shows "Cannot reach PadosiPro".

| Running the app on | `EXPO_PUBLIC_API_URL` |
| --- | --- |
| Android emulator | `http://10.0.2.2:4000` |
| iOS simulator | `http://localhost:4000` |
| Physical phone, same Wi-Fi as your machine | `http://<your-LAN-IP>:4000` (e.g. `http://192.168.1.20:4000`) |
| Physical phone, different network, or an APK | your deployed HTTPS URL |

Find your LAN IP with `ipconfig` (Windows) or `ifconfig | grep inet` (macOS/Linux). `EXPO_PUBLIC_*`
values are **inlined at bundle time**, so restart `expo start` after changing `.env`.

Every screen is native React Native — no WebView. Styling is Tailwind through
[NativeWind](https://nativewind.dev); brand tokens live in
[`mobile/global.css`](mobile/global.css), so `text-primary` is the PadosiPro green `#155C49`.

The signed-in token is kept in `expo-secure-store` (Keychain / Keystore), so a logged-in user stays
logged in across restarts.

> **Note:** `expo-secure-store` has no web implementation — `npx expo start --web` will fail at
> sign-in. The brief asks for a native app; use an emulator or a phone.

---

## 6. How email is sent

Two drivers, chosen by `MAIL_DRIVER`. **The brief asks us to say which is used: by default, none —
the OTP is written to the server log, and EmailJS is the opt-in real-mail path.**

### `console` (default, no account needed)

```bash
docker compose logs api | grep 'mail:console'
# [mail:console] OTP for you@example.com: 296189 (valid 10 minutes)
```

This is the fastest way to review the whole flow, and is what makes `docker compose up` sufficient.

### `emailjs` (real mail)

The EmailJS REST API is called **server-side only**, so the private key never ships in the app
bundle.

1. **Account** — sign up at [emailjs.com](https://www.emailjs.com).
2. **Email service** — *Email Services → Add New Service* → pick a provider (Gmail is quickest).
   Copy the **Service ID** (`service_ab12cde`) → `EMAILJS_SERVICE_ID`.
3. **Template** — *Email Templates → Create New Template*. The server sends exactly these three
   `template_params`; the names must match verbatim:

   | Template variable | What the server sends |
   | --- | --- |
   | `{{email}}` | the recipient's address |
   | `{{otp}}` | the 6-digit code |
   | `{{expiry_minutes}}` | `10` |

   Set **To Email** to `{{email}}`, or EmailJS sends every code to your own address. Example body:

   > Your PadosiPro verification code is **{{otp}}**.
   > It expires in {{expiry_minutes}} minutes. You don't manage tasks — we do.

   Copy the **Template ID** (`template_xy34zab`) → `EMAILJS_TEMPLATE_ID`.

   Any variable the template uses but the server does not send renders **blank** — EmailJS does not
   error. Keep the template to the three names above.
4. **Keys** — *Account → General → Public Key* → `EMAILJS_PUBLIC_KEY`.
   *Account → Security → Private Key* → `EMAILJS_PRIVATE_KEY`.
5. **Allow non-browser use — the step people miss.** *Account → Security* → tick **"Allow EmailJS
   API for non-browser applications"**. Without it EmailJS returns
   `403 API calls are disabled for non-browser applications`, which the API surfaces as
   `502 MAIL_FAILED`.
6. **Switch the driver** in `backend/.env` and restart:

   ```bash
   MAIL_DRIVER=emailjs
   EMAILJS_SERVICE_ID=service_ab12cde
   EMAILJS_TEMPLATE_ID=template_xy34zab
   EMAILJS_PUBLIC_KEY=...
   EMAILJS_PRIVATE_KEY=...
   ```

   The server refuses to boot on `MAIL_DRIVER=emailjs` with any of the four missing, naming each.

> **Deploying?** `MAIL_DRIVER` defaults to `console`. If it is not set explicitly in your host's
> environment, the deployed API logs OTPs instead of mailing them — with no error.

---

## 7. Building the APK

The app is configured for [EAS Build](https://docs.expo.dev/build/introduction/). The `preview`
profile in [`mobile/eas.json`](mobile/eas.json) sets `"buildType": "apk"`, so it produces an
installable `.apk` rather than an `.aab`.

```bash
cd mobile
npm install -g eas-cli      # or use npx eas-cli below
npx eas-cli login           # a free Expo account
npx eas-cli init            # once per project: writes extra.eas.projectId into app.json
npx eas build -p android --profile preview
```

EAS builds in the cloud and prints a download link when it finishes (typically 10–20 minutes).
Install the APK on any Android device — it is unsigned for the Play Store but fine for sideloading.

**Point it at a reachable API first.** An APK cannot use `localhost`. The `preview` profile sets:

```json
"env": { "EXPO_PUBLIC_API_URL": "https://padosi-pro.onrender.com" }
```

Change that to your own deployed URL before building. `mobile/.env` is **not** uploaded to EAS
(it is gitignored), which is exactly why the value lives in `eas.json`.

| App identity | Value |
| --- | --- |
| Display name | PadosiPro |
| Android package / iOS bundle | `com.padosipro.assignment` |
| Brand colour (splash, adaptive icon, `primaryColor`) | `#155C49` |
| Icons | placeholders in `mobile/assets/` — replace before any real release |

---

## 8. Tests

```bash
cd backend
npm test              # 56 unit tests; integration skips without a test database
npm run test:coverage # same, plus a coverage summary
npm run lint
npm run build         # typecheck
```

Unit tests cover the risky logic with no database and no clock: OTP generation (six digits,
zero-padded, crypto-sourced), expiry boundaries, the 5-attempt lock, single use, resend cooldown,
login rules, JWT `token_version`, mobile normalisation and password policy.

### Integration tests

These drive real HTTP against a real Postgres. They **skip automatically** unless
`TEST_DATABASE_URL` is set, so `npm test` stays green with nothing running.

```bash
# from the repo root — an ephemeral database on 5433, behind a compose profile
docker compose --profile test up -d db-test

cd backend
export TEST_DATABASE_URL=postgres://padosi:padosi@localhost:5433/padosipro_test

# DB_SSL=false matters: the local test server speaks plaintext, and if your .env points at
# Supabase (DB_SSL=true) these two CLI steps would otherwise fail with a TLS error.
DATABASE_URL=$TEST_DATABASE_URL DB_SSL=false npx prisma migrate deploy
DATABASE_URL=$TEST_DATABASE_URL DB_SSL=false npm run db:seed

npm test          # 64 tests, integration included
```

<details>
<summary>PowerShell equivalent</summary>

```powershell
$env:TEST_DATABASE_URL = "postgres://padosi:padosi@localhost:5433/padosipro_test"
$env:DATABASE_URL = $env:TEST_DATABASE_URL; $env:DB_SSL = "false"
npx prisma migrate deploy
npm run db:seed
Remove-Item Env:DATABASE_URL
npm test
```

</details>

The test run itself needs no `DB_SSL`: `tests/setup.ts` forces the database connection from
`TEST_DATABASE_URL` / `TEST_DB_SSL` and ignores `.env`, so a stray test can never reach real data.

`db-test` is behind the `test` profile, so a plain `docker compose up` never starts it, and its data
lives in tmpfs so every run begins empty. The suite covers register → verify → login → profile →
task selection, plus the attempt lock, resend-clears-attempts, identical answers for an unknown
email and a wrong password, and `token_version` revocation after logout. The mailer is stubbed to
capture the code, since only its HMAC reaches the database.

CI runs all of this on every push — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## 9. API reference

All auth routes are under `/api/auth`, rate limited to 30 requests / 15 minutes / IP.

| Route | Body | Success | Notable failures |
| --- | --- | --- | --- |
| `POST /register` | `{ email, password }` | `201` + `otpExpiresAt`, `resendAvailableAt` | `409 EMAIL_TAKEN`, `400 VALIDATION_ERROR` |
| `POST /verify-otp` | `{ email, code }` | `200` + `{ token, user }` (auto-login) | `400 OTP_INVALID` (+`details.attemptsLeft`), `400 OTP_EXPIRED`, `429 OTP_LOCKED`, `409 OTP_ALREADY_USED` |
| `POST /resend-otp` | `{ email }` | `200` + `otpExpiresAt`, `resendAvailableAt` | `429 OTP_COOLDOWN` (+`details.retryAfterSeconds`) |
| `POST /login` | `{ email, password }` | `200` + `{ token, user }` | `401 INVALID_CREDENTIALS`, `403 EMAIL_NOT_VERIFIED` |
| `POST /logout` | — (Bearer) | `200 { ok: true }` | `401 TOKEN_REVOKED` |

Everything below needs `Authorization: Bearer <token>`.

| Route | Body | Returns |
| --- | --- | --- |
| `GET /api/me` | — | `{ user, profile \| null, selectedTaskCount }` |
| `GET /api/profile` | — | `{ profile }`, or `{ profile: null }` before the first save |
| `PUT /api/profile` | `{ fullName, mobile, address, businessName? }` | `{ profile }` |
| `GET /api/tasks` | — | `{ categories: [{ id, name, sortOrder, tasks }] }` |
| `GET /api/me/tasks` | — | `{ tasks }`, each with `categoryId` and `categoryName` |
| `PUT /api/me/tasks` | `{ taskIds: number[] }` | `{ tasks }` — replaces the whole selection |

Every failure uses one shape:

```json
{ "error": { "code": "OTP_INVALID", "message": "That code is not right.",
             "details": { "attemptsLeft": 4 } } }
```

`code` is a stable string the client branches on, `message` is safe to show a user, `fields` carries
per-field validation errors, `details` carries machine-readable extras.

Passwords need 8+ characters with a letter and a number, stored with bcrypt cost 12. Codes are
6 digits, valid 10 minutes, single use, 5 wrong attempts before locking, 30-second resend cooldown.
Only `HMAC-SHA256(code, OTP_PEPPER)` is stored.

Profile rules: `fullName` 2–80 characters (letters, spaces, `.`, `'`, `-`, any script, so Devanagari
works), `address` 10–300, `businessName` optional up to 100. `mobile` accepts `9876543210`,
`+919876543210`, `+91 98765 43210` or `098765-43210` and stores `+91XXXXXXXXXX`.

---

## 10. Repo scripts

Run from the root; each delegates to `backend/` and `mobile/`.

| Script | What it does |
| --- | --- |
| `npm run setup` | Install dependencies in both packages |
| `npm run dev` | API in watch mode |
| `npm run dev:mobile` | Expo dev server |
| `npm run build` | Compile the API, typecheck the app |
| `npm test` | Tests in both packages |
| `npm run lint` | Lint both packages |

Database workflow lives in `backend/`:

```bash
npm run prisma:generate   # regenerate the typed client after editing the schema
npm run prisma:migrate    # create + apply a migration in development
npm run prisma:deploy     # apply existing migrations (CI, containers, Supabase)
npm run db:seed           # idempotent catalogue seed
npm run prisma:studio     # browse the data
npm run db:reset          # drop, re-migrate, re-seed (destructive)
```

The schema is [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). Prisma cannot express
CHECK constraints, so the lowercase-email and `+91` mobile checks are appended by hand to the
generated `prisma/migrations/*/migration.sql`.
