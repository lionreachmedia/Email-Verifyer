# MailGuard setup guide

MailGuard checks mailboxes through email-verification **APIs** (Reoon,
ZeroBounce, Emailable, Kickbox, Hunter, Reacher). You don't need port 25 or any mail-server
setup: the API provider does the mailbox check on their side.

- **Part 1 — Run it on your computer** (about 20 minutes).
- **Part 2 — Deploy on a VPS** with Docker so others can use it.

Do **Part 0** first no matter what.

---

## Part 0 — Security clean-up (do this once, now)

The old project zip contained `server/.env` with a real SMTP password and JWT
secret, and log files with your machine's paths.

1. **Change that email account's password** (or delete its app password) and
   create a new one for this app.
2. Never put `server/.env` in a zip, Git repo or chat again. It is in
   `.gitignore` now.
3. You'll generate a brand-new `JWT_SECRET` below. Using a new one signs out all
   old sessions, which is what you want.

---

## Part 1 — Run it on your computer

### 1.1 Install the tools

| Tool | Why | Get it |
|---|---|---|
| **Node.js 20 or newer** (LTS) | Runs the app | nodejs.org → LTS installer |
| **Docker Desktop** | Runs MongoDB + Redis with one command | docker.com/products/docker-desktop |
| A code editor | Editing `.env` | VS Code |

Check in a new terminal (PowerShell on Windows):

```bash
node -v      # v20.x or higher
docker -v
```

> Without Docker: install MongoDB Community Server and Redis (on Windows,
> Memurai is a Redis-compatible option), then skip step 1.3.

### 1.2 Install the project

Unzip the project, open a terminal **in the project folder**, then run:

```bash
npm run install:all
```

### 1.3 Start MongoDB and Redis

```bash
docker compose up -d
```

Check with `docker compose ps`. Both `mongo` and `redis` should say "running".

### 1.4 Create your settings file

```bash
# macOS / Linux
cp server/.env.example server/.env
# Windows PowerShell
Copy-Item server\.env.example server\.env
```

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Open `server/.env` and paste the result after `JWT_SECRET=`. Leave everything
else as it is for now.

### 1.5 Add your mailbox-check API key

**Reoon (recommended):**

1. Sign in at **emailverifier.reoon.com** and open the **API** page.
2. Create an API key and copy it.
3. In `server/.env`:

   ```env
   VERIFY_PROVIDERS=reoon
   REOON_API_KEY=paste-your-key-here
   REOON_MODE=power
   ```

   Keep `REOON_MODE=power`. That's the mode that checks the actual mailbox.
   `quick` only checks format and domain, which MailGuard already does for
   free.

**Want a backup for when Reoon credits run out?** Add a second provider after
it, e.g. `VERIFY_PROVIDERS=reoon,zerobounce` plus `ZEROBOUNCE_API_KEY=…`.
Other options: Emailable, Kickbox, Hunter (variables are listed in
`.env.example`). When one runs out of credits it is paused for an hour and the
next is used automatically.

### 1.6 Check your setup

```bash
npm run doctor
```

Fix anything marked ✘. The ! warning "MAIL_* not set" is normal on your PC.
For Reoon you should see `✔ reoon: API key accepted (…remaining credits…)`.

Test a real address end to end (uses 1 provider credit):

```bash
npm run doctor -- your.own.address@gmail.com
```

You should see `"status": "valid"`.

### 1.7 Start the app

```bash
npm run dev
```

This starts three things together: the **API** (port 5000), the **worker**
(processes bulk lists) and the **website** (port 5173).

Open **http://localhost:5173** → **Create account**. Email isn't configured
yet, so the 6-digit code is **printed in the terminal**. Look for a line like
`would send to you@… OTP=123456`.

To send real codes by email, fill in `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`,
`MAIL_PASS` and `MAIL_FROM_EMAIL`. For Gmail, use `smtp.gmail.com`, port `587`,
and an **App Password**, not your normal password.

### 1.8 Run the tests (optional)

```bash
npm test
```

All tests should pass. They don't need MongoDB, Redis or internet.

---

## Part 2 — Deploy on a VPS (Docker)

### What runs where

Everything runs on **one VPS**, under **one domain**, inside Docker. You do
**not** deploy the frontend and backend separately. The React site is built
into the same image and served by the API.

```
                 Internet
                    │  https://app.yourdomain.com
              ┌─────▼─────┐
              │   Nginx    │  HTTPS certificate (on the VPS itself)
              └─────┬─────┘
                    │ 127.0.0.1:5000
 ┌──────────────────▼──────── Docker ─────────────────────┐
 │  api      → website + REST API     ┐  same image       │
 │  worker   → processes bulk lists   ┘  (mailguard)      │
 │  mongo    → database (data kept in a Docker volume)    │
 │  redis    → job queue + cache                          │
 └────────────────────────────────────────────────────────┘
```

MongoDB and Redis are **not reachable from the internet**. Only the app talks
to them, inside Docker.

> **Already running Coolify on this VPS?** Coolify uses ports 80/443 itself,
> so skip Nginx (steps 2.6–2.7) and follow **2.10** instead.

### 2.1 Point your domain at the VPS

At your domain registrar or Cloudflare, add an **A record**:
`app` → your VPS IP (shown in your hosting panel).

Wait a few minutes, then check from your PC: `ping app.yourdomain.com` should
show the VPS IP.

### 2.2 Log in to the VPS

From PowerShell on your PC:

```bash
ssh root@YOUR_VPS_IP
```

### 2.3 Install Docker, Nginx and Certbot

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install -y nginx certbot python3-certbot-nginx unzip
docker --version && docker compose version
```

(If you picked an Ubuntu template that already has Docker, `get.docker.com`
just confirms it.)

### 2.4 Upload the project

**Option A — from your PC with `scp`** (run in PowerShell on your PC, in the
folder that contains the zip):

```bash
scp mailguard-v2.3.zip root@YOUR_VPS_IP:/opt/
```

Then on the VPS:

```bash
cd /opt && unzip mailguard-v2.3.zip && mv email-verification-saas mailguard && cd mailguard
```

**Option B — Git:** push the project to a **private** repo and `git clone` it
into `/opt/mailguard`. `.gitignore` already keeps `.env` out of Git.

### 2.5 Create the production settings

```bash
cd /opt/mailguard
cp server/.env.example server/.env
nano server/.env
```

Fill in (paste with right-click in most SSH windows; save with Ctrl+O, Enter, Ctrl+X):

```env
CLIENT_URL=https://app.yourdomain.com
TRUST_PROXY=1

JWT_SECRET=<NEW secret: run the command below and paste the result>

MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=<same as on your PC>
MAIL_PASS=<same app password as on your PC>
MAIL_FROM_EMAIL=<same as MAIL_USER>
MAIL_FROM_NAME=MailGuard

VERIFY_PROVIDERS=reoon
REOON_API_KEY=<your key>
REOON_MODE=power
```

Make a new secret for the server (don't reuse your PC's):

```bash
openssl rand -hex 48
```

You **don't** need to set `MONGO_URI`, `REDIS_URL`, `NODE_ENV`, `PORT` or
`SERVE_CLIENT`. `docker-compose.prod.yml` sets those for the containers.

Lock the file so only root can read it:

```bash
chmod 600 server/.env
```

### 2.6 Start everything

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The first build takes a few minutes. Then check:

```bash
docker compose -f docker-compose.prod.yml ps        # all 4 services "running" / "healthy"
curl http://127.0.0.1:5000/health                    # {"status":"ok",...}
docker compose -f docker-compose.prod.yml exec api node src/scripts/doctor.js
```

Doctor should say **All good**. To check one real address (uses 1 Reoon credit):

```bash
docker compose -f docker-compose.prod.yml exec api node src/scripts/doctor.js you@gmail.com
```

### 2.7 Nginx + free HTTPS

```bash
nano /etc/nginx/sites-available/mailguard
```

Paste (replace the domain):

```nginx
server {
    listen 80;
    server_name app.yourdomain.com;
    client_max_body_size 25m;          # allow 20 MB CSV uploads

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;       # single checks can take a while
    }
}
```

Enable it and get the certificate:

```bash
ln -s /etc/nginx/sites-available/mailguard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
certbot --nginx -d app.yourdomain.com
```

Certbot asks for your email and sets up auto-renewal. Open
**https://app.yourdomain.com**, register, and the code should arrive by email.
Then check **Settings → System status**: everything should be OK.

### 2.8 Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

If your hosting panel also has a firewall, allow ports **22, 80, 443** there
too.

### 2.9 Day-to-day commands

Run these inside `/opt/mailguard`. Tip: `alias dc='docker compose -f docker-compose.prod.yml'`
saves typing.

| Task | Command |
|---|---|
| See status | `docker compose -f docker-compose.prod.yml ps` |
| Live logs | `docker compose -f docker-compose.prod.yml logs -f api worker` |
| Restart after editing `.env` | `docker compose -f docker-compose.prod.yml up -d` |
| Deploy a new version | upload/`git pull`, then `docker compose -f docker-compose.prod.yml up -d --build` |
| Stop everything | `docker compose -f docker-compose.prod.yml down` (data is kept) |
| Add credits to a user | `docker compose -f docker-compose.prod.yml exec mongo mongosh mailguard --eval 'db.users.updateOne({email:"you@x.com"},{$inc:{credits:1000}})'` |

⚠️ Never run `down -v`. The `-v` deletes the database volume.

**Backups** (daily at 3 am, keeps 14 days):

```bash
mkdir -p /opt/backups
crontab -e
```

Add this line:

```
0 3 * * * cd /opt/mailguard && docker compose -f docker-compose.prod.yml exec -T mongo mongodump --archive --gzip --db mailguard > /opt/backups/mailguard-$(date +\%F).gz && find /opt/backups -name 'mailguard-*.gz' -mtime +14 -delete
```

Restore a backup:

```bash
docker compose -f docker-compose.prod.yml exec -T mongo mongorestore --archive --gzip --drop < /opt/backups/mailguard-YYYY-MM-DD.gz
```

Copy backups off the server now and then (e.g. `scp` them to your PC).

### 2.10 Alternative: Coolify with 5 separate services (Docker)

Use this if your VPS runs Coolify and you prefer one service per part.
Each app service is built from its own Dockerfile, so Nixpacks isn't needed.

**Before you start:** push the project to a **private GitHub repo**, and add two
DNS A records: `app.yourdomain.com` and `api.yourdomain.com` → VPS IP. Then
open (or create) a Coolify project, e.g. `MailGuard` → production.

**1. MongoDB:** **+ New → Databases → MongoDB → Start.** Copy the
*internal* URL and use it in this form (add the database name and
`authSource=admin`):
`mongodb://root:PASSWORD@HOST:27017/mailguard?authSource=admin&directConnection=true`

**2. Redis:** **+ New → Databases → Redis → Start.** Copy the
*internal* URL, e.g. `redis://default:PASSWORD@HOST:6379/0`.

**3. Backend:** **+ New → Private Repository**, pick the repo, Build Pack **Dockerfile**.

| Setting | Value |
|---|---|
| Base Directory | `/server` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `5000` |
| Domains | `https://api.yourdomain.com` |

Environment variables (Developer view, paste and fill in):

```env
NODE_ENV=production
PORT=5000
MONGO_URI=<MongoDB internal URL from step 1>
REDIS_URL=<Redis internal URL from step 2>
JWT_SECRET=<openssl rand -hex 48>
CLIENT_URL=https://app.yourdomain.com
SERVE_CLIENT=false
TRUST_PROXY=1
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=...
MAIL_PASS=...
MAIL_FROM_EMAIL=...
MAIL_FROM_NAME=MailGuard
VERIFY_PROVIDERS=reoon
REOON_API_KEY=...
REOON_MODE=power
```

Deploy. Check that `https://api.yourdomain.com/health` shows `{"status":"ok"}`.

**4. Worker:** **+ New → Private Repository**, same repo, Build Pack **Dockerfile**.

| Setting | Value |
|---|---|
| Base Directory | `/server` |
| Dockerfile Location | `/Dockerfile.worker` |
| Ports Exposes | `5000` (required field; nothing listens on it) |
| Domains | *(empty)* |
| Health check | **off** |

Environment variables: **the same block as the backend**. Deploy. The worker's
logs should show `[worker] listening on "email-verification"`.

**5. Frontend:** **+ New → Private Repository**, same repo, Build Pack **Dockerfile**.

| Setting | Value |
|---|---|
| Base Directory | `/client` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `80` |
| Domains | `https://app.yourdomain.com` |

Environment variable (tick **Build Variable**, because it's baked into the
website when it's built):

```env
VITE_API_URL=https://api.yourdomain.com/api
```

Deploy. The build log shows `Building with VITE_API_URL=…`. If it shows
`/api` instead, the Build Variable tick is missing: fix it and redeploy.

**Check:** backend → **Terminal** → `node src/scripts/doctor.js` should be
**All good** (including "worker is running"). Then open
`https://app.yourdomain.com` and sign up.

**Updating:** push to GitHub, then **Redeploy** backend, worker and frontend
(or turn on automatic deployments).

| Problem | Fix |
|---|---|
| Website loads but sign-in says network error | `VITE_API_URL` wrong or not a Build Variable → fix, redeploy frontend |
| CORS error in the browser console | Backend `CLIENT_URL` must be exactly `https://app.yourdomain.com` (no trailing `/`) |
| Backend log: `Authentication failed` | Add `authSource=admin` to `MONGO_URI` |
| Bulk stuck at 0% | Worker not running or missing env vars → check its logs |

Coolify's menus vary a little between versions. Match these settings to what
you see.

### 2.11 Making API credits last

- Every definite result is cached for 72 hours (`VERIFY_CACHE_TTL_HOURS`).
- Bad formats, non-existent domains, domains with no mail server and
  disposable inboxes are caught **before** Reoon is called, so they cost
  nothing.
- Add a backup provider (`VERIFY_PROVIDERS=reoon,zerobounce`). When one runs
  out of credits it is paused for an hour and the next is used.

---

## Part 3 — Moving over from the old version

You can point the new version at your **existing** MongoDB database.

- **Users** keep their accounts and passwords. Everyone signs in once more
  (new session format). Gmail users whose address was stored without dots by
  the old version can still sign in with the dotted form.
- **Old history** stays visible. Old rows just won't have a "reason".
- **Old bulk jobs stuck at "processing"** can be closed with one command in
  `mongosh`:

  ```js
  use mailguard
  db.bulkjobs.updateMany({ status: { $in: ['queued','processing'] } }, { $set: { status: 'failed', error: 'Closed during upgrade' } })
  ```

- If the server log says it couldn't build the index `bulkJobId_1_email_1`,
  old jobs contain duplicate rows (an old-version bug). It's harmless for new
  jobs; to clear it, delete old bulk rows: `db.verifications.deleteMany({ bulkJobId: { $ne: null }, reason: { $exists: false } })`.
- Old results were produced by the buggy checker. **Re-verify** any list you
  still plan to use.

---

## Troubleshooting

| You see | Cause | Fix |
|---|---|---|
| Banner: "No mailbox checker is configured" | `VERIFY_PROVIDERS` lists checkers without keys/settings | Fill the matching variables, run `npm run doctor`, restart |
| Banner: "worker is not running" / bulk stuck at 0% | Worker not started | Dev: use `npm run dev`. Prod: `docker compose -f docker-compose.prod.yml logs worker` |
| doctor: `reoon: balance check failed` | Wrong key, or key not active yet | Copy the key again from emailverifier.reoon.com → API, restart |
| Many `unknown` with "Checker API key rejected" | Wrong or expired API key | Copy the key again from the provider's dashboard, restart |
| Many `unknown` with "Checker out of credits" | Free tier used up | Wait for the reset, add another provider to `VERIFY_PROVIDERS`, or upgrade |
| `unknown` with "DNS lookup failed" | The machine's DNS is broken or blocked | Linux: set `nameserver 1.1.1.1` in `/etc/resolv.conf`. Office PC: ask IT, or try another network |
| Sign-up code email never arrives | `MAIL_*` wrong | `npm run doctor` shows the SMTP login error |
| `Not enough credits` | Balance too low | See "Add credits to a user" in 2.9 |

**About accuracy:** no checker, free or paid, can confirm every mailbox.
Catch-all domains accept everything by design, and some providers hide whether
an inbox exists. MailGuard reports those honestly as `catch-all` / `unknown`
instead of guessing.
| `502 Bad Gateway` from Nginx | App container not running | `docker compose -f docker-compose.prod.yml ps`, then `logs api` |
| Build fails: "no space left on device" | Old images filling the disk | `docker system prune` (keeps volumes/data) |
