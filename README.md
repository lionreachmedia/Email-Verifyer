# MailGuard — Email Verification SaaS

Verify single emails or whole lists: syntax, domain, mail server, disposable
inboxes, role addresses, catch-all domains and the mailbox itself.

**Design rule: no fake results.** An address is only marked *invalid* with
proof (bad format, domain doesn't exist, no mail server, or a mail server /
checker rejected the mailbox). Anything that can't be proven comes back as
*unknown* with the reason attached, and the user isn't charged for it.

➡️ **New here? Follow [SETUP.md](SETUP.md) step by step.**

## How a check works

```
email ─▶ format ─▶ typo / role / free ─▶ cache ─▶ DNS (MX) ─▶ disposable ─▶ mailbox-check API(s) ─▶ result
                                                                                     reoon → zerobounce → …
                                                                                     (first definite answer wins)
```

| Result      | Meaning                                                                    |
|-------------|----------------------------------------------------------------------------|
| `valid`     | Mailbox confirmed. Safe to send.                                           |
| `invalid`   | Proven undeliverable. Do not send.                                         |
| `risky`     | Mailbox full, disposable inbox, spam trap, etc.                            |
| `catch-all` | Domain accepts any address, so this mailbox can't be confirmed.            |
| `unknown`   | No definite answer (API couldn't tell, out of credits, no API set). Not charged. |

Every result also carries `reason` (machine code), `details` (plain English) and
`provider` (who answered).

## Project structure

```
├── client/                  React + Vite + Tailwind
│   └── src/
│       ├── components/      AuthShell, OtpForm, StatusBadge, Logo
│       ├── context/         AuthContext (session)
│       ├── layouts/         AppLayout (sidebar, status banner)
│       ├── lib/             reasons.js (labels for result reasons)
│       ├── pages/           Dashboard, SingleVerify, BulkVerify, History, Analytics, Settings, auth pages
│       └── services/        api.js (all HTTP calls)
├── server/                  Node + Express + MongoDB + BullMQ
│   ├── src/
│   │   ├── config/          env (all settings), db, redis
│   │   ├── controllers/     auth, verify, analytics, user
│   │   ├── middleware/      auth (JWT + API key), rate limits, validation, errors
│   │   ├── models/          User, Verification, BulkJob
│   │   ├── queue/           BullMQ queue + worker
│   │   ├── routes/          index.js (every endpoint in one place)
│   │   ├── services/
│   │   │   ├── verification/   the engine: local checks, DNS, cache, providers/* (API adapters)
│   │   │   ├── bulk.js         bulk job bookkeeping (idempotent)
│   │   │   └── credits.js
│   │   ├── scripts/doctor.js   setup checker
│   │   ├── server.js        API entry
│   │   └── worker.js        worker entry
│   ├── test/                node:test suites (no DB needed)
│   └── .env.example         every setting, documented
├── docker-compose.yml       MongoDB + Redis for local development
├── docker-compose.prod.yml  Production: api + worker + MongoDB + Redis
├── Dockerfile               Builds the website + server into one image
└── SETUP.md                 step-by-step setup guide
```

## Commands (from the project root)

| Command                         | What it does                                              |
|---------------------------------|-----------------------------------------------------------|
| `npm run install:all`           | Install root, server and client dependencies              |
| `npm run dev`                   | API + worker + React dev server together                  |
| `npm run doctor`                | Check MongoDB, Redis, email settings and API keys         |
| `npm run doctor -- a@b.com`     | …and verify one real address end to end                  |
| `npm test`                      | Run the server test suite                                 |
| `npm run build`                 | Build the React app into `client/dist`                    |
| `npm start` / `npm run worker`  | Run API / worker without Docker                           |
| `docker compose -f docker-compose.prod.yml up -d --build` | Production deploy (see SETUP.md Part 2) |

## API

Authenticate with `Authorization: Bearer <token>` (dashboard login) or
`x-api-key: mg_…` (create one in **Settings**).

| Method | Endpoint                          | Notes                                       |
|--------|-----------------------------------|---------------------------------------------|
| POST   | `/api/auth/register`              | `{ name, email, password }` → emails a code |
| POST   | `/api/auth/verify-otp`            | `{ email, otp }` → `{ token, user }`        |
| POST   | `/api/auth/resend-otp`            | `{ email }` (60 s cooldown)                 |
| POST   | `/api/auth/login`                 | `{ email, password }`                       |
| POST   | `/api/auth/forgot-password`       | `{ email }`                                 |
| POST   | `/api/auth/reset-password`        | `{ token, password }`                       |
| GET    | `/api/auth/me`                    | Current user                                |
| POST   | `/api/verify/single`              | `{ email }` → result (1 credit, 0 if unknown) |
| POST   | `/api/verify/bulk`                | multipart `file` (.csv/.txt) → `{ jobId }`  |
| GET    | `/api/verify/bulk/:jobId`         | Progress and counts                         |
| GET    | `/api/verify/jobs`                | Last 20 bulk jobs                           |
| GET    | `/api/verify/history`             | `?page&limit&status&search&jobId`           |
| GET    | `/api/verify/export`              | CSV, `?jobId&status`                        |
| GET    | `/api/analytics/stats`, `/chart`  | Dashboard data                              |
| POST/DELETE | `/api/user/api-key`          | Create (shown once) / revoke                |
| GET    | `/api/system/status`              | Worker online? Which checkers configured?   |
