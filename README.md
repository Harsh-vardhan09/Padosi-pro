# PadosiPro

> You don't manage tasks — we do.

Take-home monorepo: an Express + PostgreSQL API and an Expo (React Native) app.

## Layout

```
backend/            Node.js + TypeScript + Express API
mobile/             Expo (React Native) + TypeScript app, styled with Tailwind (NativeWind)
docker-compose.yml  Postgres 16 + the API, for a one-command local run
DESIGN.md           Architecture and decisions
CLAUDE.md           Project rules
```

## Run it (one command, no Supabase account)

```bash
docker compose up
```

- API: <http://localhost:4000>
- Health check: `curl http://localhost:4000/health` → `{"ok":true}`
- Postgres: `localhost:5432` (user `padosi`, password `padosi`, db `padosipro`)

The API container runs `prisma migrate deploy` and the seed before it starts listening, so the
database is ready as soon as it reports healthy. Stop with `Ctrl+C`; `docker compose down -v` also
removes the database volume, and the next `up` rebuilds everything from scratch.

## Verify the schema and seed

Against the local Docker Postgres:

```bash
# 7 tables: users, email_otps, profiles, task_categories, tasks, user_tasks, _prisma_migrations
docker compose exec db psql -U padosi -d padosipro -c '\dt'

# which migrations have been applied
docker compose exec db psql -U padosi -d padosipro -c 'table _prisma_migrations'

# 6 categories, 28 tasks
docker compose exec db psql -U padosi -d padosipro -c "
  select c.sort_order, c.name as category, count(t.id) as tasks
  from task_categories c left join tasks t on t.category_id = c.id
  group by c.id, c.sort_order, c.name order by c.sort_order;"
```

Against whatever `backend/.env` points at (Supabase included), with no psql needed:

```bash
cd backend
npx prisma migrate status     # every migration applied?
npm run prisma:studio         # browse the tables in a browser
```

Expected: **6 categories / 28 tasks**. The seed is idempotent — it upserts, so re-running
`npm run db:seed` leaves the counts unchanged and refreshes any edited description.

## Database workflow

```bash
cd backend
npm run prisma:generate   # regenerate the typed client after editing the schema
npm run prisma:migrate    # create + apply a migration in development
npm run prisma:deploy     # apply existing migrations (CI, containers, Supabase)
npm run db:seed           # idempotent catalogue seed
npm run prisma:studio     # browse the data
npm run db:reset          # drop, re-migrate and re-seed (destructive)
```

The schema lives in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). Prisma cannot
express CHECK constraints, so the lowercase-email and `+91` mobile checks are appended by hand to
`prisma/migrations/*/migration.sql`.

### Pointing at Supabase

Supabase's direct host (`db.<ref>.supabase.co`) resolves to **IPv6 only**. On an IPv4-only network
it fails with `ENOTFOUND`, so use the **session pooler** connection string instead — port 5432, user
`postgres.<project-ref>`, host `aws-0-<region>.pooler.supabase.com`. Copy it from the Supabase
dashboard: *Connect → Session pooler*. Set `DB_SSL=true` alongside it. Avoid the transaction pooler
(6543) for migrations; it disables the prepared statements Prisma Migrate needs.

```bash
cd backend
npm run prisma:deploy
npm run db:seed
```

## Run it without Docker

```bash
npm run setup                      # installs backend + mobile deps

cp backend/.env.example backend/.env
docker compose up -d db            # or point DATABASE_URL at your own Postgres
npm run dev                        # API on http://localhost:4000
```

`DATABASE_URL` in `backend/.env` can point at the Docker Postgres above or at a
Supabase project (Project Settings → Database → Connection string → URI). We talk
to Supabase as plain Postgres over that connection string — no `supabase-js`.

## Auth API

All routes are under `/api/auth` and rate limited to 30 requests per 15 minutes per IP.

| Route | Body | Success | Notable failures |
| --- | --- | --- | --- |
| `POST /register` | `{ email, password }` | `201` + `otpExpiresAt`, `resendAvailableAt` | `409 EMAIL_TAKEN`, `400 VALIDATION_ERROR` |
| `POST /verify-otp` | `{ email, code }` | `200` + `{ token, user }` (auto-login) | `400 OTP_INVALID` (+`details.attemptsLeft`), `400 OTP_EXPIRED`, `429 OTP_LOCKED`, `409 OTP_ALREADY_USED` |
| `POST /resend-otp` | `{ email }` | `200` + `otpExpiresAt`, `resendAvailableAt` | `429 OTP_COOLDOWN` (+`details.retryAfterSeconds`) |
| `POST /login` | `{ email, password }` | `200` + `{ token, user }` | `401 INVALID_CREDENTIALS`, `403 EMAIL_NOT_VERIFIED` |
| `POST /logout` | — (Bearer token) | `200 { ok: true }` | `401 TOKEN_REVOKED` / `TOKEN_INVALID` |

Passwords need 8+ characters with a letter and a number, and are stored with bcrypt cost 12.
Codes are 6 digits, valid 10 minutes, single use, 5 wrong attempts before the code locks, and a
30-second resend cooldown. Only `HMAC-SHA256(code, OTP_PEPPER)` is stored — never the code.
Registering again with an unverified email updates the password and resends, respecting the cooldown.

`POST /logout` increments `token_version`, so every token issued before it stops working.

### Smoke test

With the stack running, this walks register → verify → login → logout and asserts every status:

```bash
./scripts/smoke-auth.sh                       # throwaway email, code read from the API log
./scripts/smoke-auth.sh you@example.com       # a real inbox (needs MAIL_DRIVER=emailjs)
```

## Email (OTP delivery)

`MAIL_DRIVER=console` (the default) prints the code to the server log — nothing to configure:

```bash
docker compose logs api | grep 'mail:console'
# [mail:console] OTP for you@example.com: 296189 (valid 10 minutes)
```

### Setting up EmailJS for real mail

1. **Create an account** at [emailjs.com](https://www.emailjs.com) and sign in.
2. **Add an email service.** *Email Services → Add New Service* → pick your provider (Gmail is
   quickest; it opens an OAuth consent screen). Copy the **Service ID** — it looks like
   `service_ab12cde` → `EMAILJS_SERVICE_ID`.
3. **Create the template.** *Email Templates → Create New Template*. The server sends exactly three
   `template_params`, so use these names verbatim:

   | Template variable | What the server sends |
   | --- | --- |
   | `{{to_email}}` | the recipient's address |
   | `{{otp_code}}` | the 6-digit code |
   | `{{expiry_minutes}}` | `10` |

   In the template's **Settings → To Email** field put `{{to_email}}`, otherwise EmailJS sends every
   code to your own address. Subject: `Your PadosiPro verification code`. Body, for example:

   > Your PadosiPro verification code is **{{otp_code}}**.
   > It expires in {{expiry_minutes}} minutes. You don't manage tasks — we do.

   Copy the **Template ID** (`template_xy34zab`) → `EMAILJS_TEMPLATE_ID`.
4. **Copy the keys.** *Account → General → Public Key* → `EMAILJS_PUBLIC_KEY`.
   *Account → Security → Private Key* → `EMAILJS_PRIVATE_KEY`.
5. **Allow non-browser use — this is the step people miss.** *Account → Security* → tick
   **"Allow EmailJS API for non-browser applications"**. EmailJS blocks server-side calls by
   default and returns `403 API calls are disabled for non-browser applications`, which our API
   surfaces as `502 MAIL_FAILED`. While you are on that screen, leave **Use Private Key** enabled
   so the `accessToken` we send is accepted.
6. **Switch the driver** in `backend/.env` and restart:

   ```bash
   MAIL_DRIVER=emailjs
   EMAILJS_SERVICE_ID=service_ab12cde
   EMAILJS_TEMPLATE_ID=template_xy34zab
   EMAILJS_PUBLIC_KEY=...
   EMAILJS_PRIVATE_KEY=...
   ```

   The server refuses to boot on `MAIL_DRIVER=emailjs` with any of the four missing, naming each one.
   Keys stay server-side; the mobile app never sees them.

## Mobile app

```bash
npm run dev:mobile                 # or: cd mobile && npx expo start
```

Then scan the QR code with Expo Go, or press `a` / `i` for Android or iOS.
The app currently renders a single screen reading **PadosiPro**.

Styling is Tailwind, via [NativeWind](https://nativewind.dev) — real React Native views with
`className`, no WebView. Brand tokens live in [`mobile/global.css`](mobile/global.css), so
`text-primary` is the PadosiPro green:

```tsx
<Text className="text-3xl font-bold text-primary">PadosiPro</Text>
```

## Scripts

Run from the repo root; each delegates to `backend/` and `mobile/`.

| Script | What it does |
| --- | --- |
| `npm run setup` | Install dependencies in both packages |
| `npm run dev` | Start the API in watch mode |
| `npm run dev:mobile` | Start the Expo dev server |
| `npm run build` | Compile the API, typecheck the app |
| `npm test` | Run tests |
| `npm run lint` | Lint both packages |

## Environment

Every variable the server reads is listed with a comment in
[`backend/.env.example`](backend/.env.example). Real values never get committed. The server
validates all of them at boot and refuses to start with a message naming each bad variable.

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Plain Postgres connection string — local Docker or Supabase. |
| `DB_SSL` | `false` for local Docker, `true` for Supabase. |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Token signing key (min 16 chars) and lifetime, default `7d`. |
| `OTP_PEPPER` | Server-side secret mixed into the OTP hash (min 16 chars). |
| `MAIL_DRIVER` | `console` (default) logs the OTP; `emailjs` sends real mail and then requires the four `EMAILJS_*` values. |

With the default `MAIL_DRIVER=console`, OTPs are printed to `docker compose logs api` — no email
account needed to run the flow.
