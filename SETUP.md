# MailGuard setup guide

MailGuard checks mailboxes through email-verification **APIs** (Reoon,
ZeroBounce, Emailable, Kickbox, Hunter, Reacher). You don't need port 25 or any mail-server
setup: the API provider does the mailbox check on their side.

- **Part 1 — Run it on your computer** (about 20 minutes).
- **Part 2 — Put it on a server** so others can use it.

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

## Part 2 — Put it on a server

Any small Linux VPS works (1 CPU / 1–2 GB RAM is plenty to start). Example
below uses Ubuntu 22.04/24.04 and the domain `app.yourdomain.com`.

### 2.1 DNS

At your domain registrar or Cloudflare, add an **A record**: `app` → your server's IP.

### 2.2 Prepare the server

```bash
sudo apt update && sudo apt upgrade -y
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx
# Docker (runs MongoDB + Redis)
curl -fsSL https://get.docker.com | sudo sh
# PM2 keeps the app running and restarts it after reboots
sudo npm install -g pm2
```

### 2.3 Upload and install

Upload the project (Git, SFTP or `scp`) to e.g. `/var/www/mailguard`, then:

```bash
cd /var/www/mailguard
npm run install:all
docker compose up -d
cp server/.env.example server/.env
nano server/.env
```

### 2.4 Production `.env`

```env
NODE_ENV=production
PORT=5000
CLIENT_URL=https://app.yourdomain.com
SERVE_CLIENT=true
TRUST_PROXY=1

JWT_SECRET=<new 96-character secret from step 1.4>

# Needed in production so users receive sign-up codes and reset links
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=you@yourdomain.com
MAIL_PASS=<app password>
MAIL_FROM_EMAIL=you@yourdomain.com
MAIL_FROM_NAME=MailGuard

# Mailbox-check APIs, tried in order (add more as fallbacks for when credits run out)
VERIFY_PROVIDERS=reoon
REOON_API_KEY=<key>
REOON_MODE=power
```

### 2.5 Build and start

```bash
npm run build                      # builds the website into client/dist
npm run doctor                     # everything should be ✔
npm run doctor -- you@gmail.com    # real end-to-end test (uses 1 API credit)
pm2 start ecosystem.config.js      # starts API + worker
pm2 save && pm2 startup            # survive reboots (run the command it prints)
```

### 2.6 Nginx + HTTPS

`/etc/nginx/sites-available/mailguard`:

```nginx
server {
    server_name app.yourdomain.com;
    client_max_body_size 25m;          # allow 20 MB CSV uploads

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mailguard /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.yourdomain.com
```

Open **https://app.yourdomain.com**, sign up, and check **Settings → System
status**: everything should say OK.

### 2.7 Firewall

Only web traffic and SSH should be reachable from outside. MongoDB and Redis
are already bound to `127.0.0.1` by `docker-compose.yml`.

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

### 2.8 Updating later

```bash
cd /var/www/mailguard && git pull     # or upload the new files
npm run install:all && npm run build
pm2 restart all
```

### 2.9 Making API credits last

- Every result is cached for 72 hours (`VERIFY_CACHE_TTL_HOURS`), so the same
  address checked twice costs one API call.
- Bad formats, non-existent domains, domains with no mail server and
  disposable inboxes are caught **before** the API is called, so they cost no
  API credits.
- List several APIs in `VERIFY_PROVIDERS`. When one runs out of credits it is
  paused for an hour and the next one is used automatically.

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
| Banner: "worker is not running" / bulk stuck at 0% | Worker process not started | Dev: use `npm run dev`. Prod: `pm2 status`, `pm2 logs mailguard-worker` |
| doctor: `reoon: balance check failed` | Wrong key, or key not active yet | Copy the key again from emailverifier.reoon.com → API, restart |
| Many `unknown` with "Checker API key rejected" | Wrong or expired API key | Copy the key again from the provider's dashboard, restart |
| Many `unknown` with "Checker out of credits" | Free tier used up | Wait for the reset, add another provider to `VERIFY_PROVIDERS`, or upgrade |
| `unknown` with "DNS lookup failed" | The machine's DNS is broken or blocked | Linux: set `nameserver 1.1.1.1` in `/etc/resolv.conf`. Office PC: ask IT, or try another network |
| Sign-up code email never arrives | `MAIL_*` wrong | `npm run doctor` shows the SMTP login error |
| `Not enough credits` | Balance too low | In `mongosh`: `db.users.updateOne({email:'you@x.com'},{$inc:{credits:1000}})` |

**About accuracy:** no checker, free or paid, can confirm every mailbox.
Catch-all domains accept everything by design, and some providers hide whether
an inbox exists. MailGuard reports those honestly as `catch-all` / `unknown`
instead of guessing.
