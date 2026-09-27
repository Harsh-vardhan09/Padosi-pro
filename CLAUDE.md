# CLAUDE.md — PadosiPro

Project rules for every session. Read before writing code.

## Product
- App name: **PadosiPro** — a lifestyle-management service.
- Tagline: **You don't manage tasks — we do.**
- Brand primary colour: `#155C49`.

## Repo layout
| Path | What it is |
| --- | --- |
| `backend/` | Node.js + TypeScript + Express API. PostgreSQL via `pg` and a plain connection string. |
| `mobile/` | Expo (React Native) + TypeScript app. |
| `docker-compose.yml` | Local Postgres 16 + the API. `docker compose up` must be the only command a reviewer needs. |
| `ASSIGNMENT.md` | The take-home brief (source of truth for scope). |
| `DESIGN.md` | Architecture and decisions. |

## Stack constraints (fixed — do not swap)
- Backend: Node.js, TypeScript, Express.
- Database: PostgreSQL, hosted on Supabase, used as **plain Postgres via a connection string**. Do **not** use `supabase-js`, Supabase Auth, or RLS-based auth.
- OTP email: **EmailJS REST API**, called server-side only. EmailJS keys never reach the mobile app.
- Mobile: Expo + TypeScript. **No WebViews** — every screen is native React Native.
- Mobile styling: **Tailwind via NativeWind** (`className`). Do not use `StyleSheet.create` or inline
  `style` objects; brand tokens live in `mobile/global.css`, not in a JS colours file.

## TypeScript
- `strict: true` everywhere. No `any` — not in code, not in tests, not behind a cast.
- Prefer `unknown` at boundaries, then narrow with zod.
- No non-null assertions (`!`) to silence the compiler; handle the absent case.

## Backend rules
- **Every** external input (body, query, params, headers, env) is validated with **zod**. Handlers receive already-parsed, typed data.
- One error shape for every failure response:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "Human-readable summary", "fields": { "email": "Must be a valid email" } } }
  ```
  - `code`: stable `SCREAMING_SNAKE_CASE` string the client can branch on.
  - `message`: safe to show a user. Never leak stack traces, SQL, or provider payloads.
  - `fields`: optional, only for per-field validation errors.
- Errors are thrown as typed `AppError`s and serialised by the single error middleware. Handlers do not build error JSON themselves.
- SQL uses parameterised queries only (`$1`, `$2`). No string interpolation into SQL, ever.

## Secrets
- Never commit secrets. No keys in code, tests, fixtures, or committed config.
- Every env var the app reads must exist in `backend/.env.example` with a one-line comment saying what it is and where to get it.
- Secrets live only in the server. The mobile app talks to our API, never to a third-party provider directly.

## Style
- Small, readable files. One clear responsibility per file; split before a file gets sprawling.
- Plain, explicit code over clever code. **I must be able to explain every line in an interview** — if a line needs a paragraph of justification, pick the simpler version.
- No speculative abstraction: no layer, helper, or config flag added for a requirement that does not exist yet.

## Comments
- **Do not write useless comments.** No comment that restates what the code already says, no
  file-header blurbs, no section banners, no TODO noise, no docstring on an obvious function.
- Comment **only** the parts that are genuinely hard to understand: a non-obvious constraint, a
  workaround and why it is needed, a pinned version, a reason the obvious approach does not work.
- **Two lines maximum** per comment. If it needs more, the code is too clever — simplify the code.
- The exception is `backend/.env.example`, where every variable carries a one-line comment by rule.

## Before saying a task is done
- `npm run lint`, `npm run build`, and `npm test` pass in `backend/`.
- `docker compose up` still brings up Postgres + API and `GET /health` returns `{ "ok": true }`.
