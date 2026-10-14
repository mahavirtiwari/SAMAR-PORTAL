# QCI SAMAR - Deployment

## Environments

| Environment | Deploys | Target | URL |
|------------|---------|--------|-----|
| **Development** | Backend + Frontend | Webority dev VM `vm-webhost-dev-cin-01` (20.204.69.31, Central India) | Backend: https://samar-api.webority.dev · Frontend: https://samar.webority.dev |
| **Staging** | Backend + Frontend | Linux VM (13.232.227.197) | https://qcisamartest.qci.org.in |

> All environments run on Linux VMs (nginx + php8.4-fpm + local MySQL) and deploy via SSH+rsync. They differ only in SSH auth: dev uses **Entra ID SSH** (`az ssh config`, no PEM), staging uses a **PEM key**. Use the unified command below so they never drift.
>
> The dev **frontend** deploys from the `qci-samar-web` repo's own `deploy/deploy-dev.sh` (rsync of the Vite build into the nginx document root — static files, no application process to restart); the unified command below invokes it for you.
>
> Dev's fixed egress IP (for partner IP-whitelisting: Protean GST, ICICI) is the VM IP **20.204.69.31**. Staging's is **13.232.227.197**.

## Environment configuration (read before "fixing" the deploy to exclude `.env`)

This project uses a **custom layered env loader** — `app/Support/EnvironmentLoader.php`, invoked from `bootstrap/app.php` — modelled on .NET's `appsettings.json` + `appsettings.{Environment}.json`:

1. `APP_ENV` is read from the **system environment first**; the deploy pipelines `export APP_ENV=<env>` before `php artisan config:cache`, so the cached config (what php-fpm serves from) is always the fully-merged per-environment view.
2. Base **`.env`** is loaded (common settings + a developer's *local* values).
3. If `APP_ENV` is set and not `local`, **`.env.{APP_ENV}`** (e.g. `.env.development`) is merged **on top and overrides** the base for env-specific keys (`APP_URL`, `DB_*`, `APP_KEY`, `APP_DEBUG`, …).

**Consequences for deployment — the deploy scripts ship *all* `.env*` files on purpose:**

- The committed `.env.development` / `.env.staging` / `.env.production` carry the real per-environment config; nothing is configured server-side except what the pipeline caches.
- A developer's local base **`.env`** (typically `APP_ENV=local`, `DB_HOST=127.0.0.1`) is **harmless in a deploy**: on the server `APP_ENV=development` selects `.env.development`, whose values override the base. So the localhost base `.env` never reaches a running dev/staging app.
- **Do NOT "harden" the deploy by excluding `.env`.** Excluding it would drop the base layer (common settings like `MAIL_*`, `APP_VERSION`) and misread the model — the safety comes from the override precedence, not from withholding the base file.

If you ever see a warning like "shipping the local `.env` will overwrite prod config" — it's a false alarm; the loader's override precedence handles it.

## Unified Deployment (recommended — keeps dev and staging in parity)

```bash
./deploy/deploy.sh            # all: dev backend + dev frontend + staging backend + staging frontend
./deploy/deploy.sh backend    # dev backend + staging backend
./deploy/deploy.sh frontend   # dev frontend + staging frontend
./deploy/deploy.sh dev        # dev backend + dev frontend (leaves staging alone)
./deploy/deploy.sh staging    # staging backend + staging frontend (leaves dev alone)
./deploy/deploy.sh status     # parity check only — what commit is each env running?
```

### What it does
1. Refuses to run on a dirty tree or a branch other than `development`.
2. `git pull --ff-only` on the backend (and `qci-samar-web` when frontend is in scope) so you always ship the latest.
3. Stamps the deployed git SHA into `public/deployed-commit.txt` (gitignored; shipped in the deploy package). The frontend stamps itself: `qci-samar-web`'s `prebuild.js` writes the web repo's SHA into the bundle's `version.json` on every build.
4. Deploys every target in scope from that one checkout: backend via this repo's `deploy-dev.sh` / `deploy-staging.sh`, and the dev frontend via `qci-samar-web`'s own `deploy/deploy-dev.sh`.
5. **Parity check, both halves**: backends via `/api/v1/system/status` (`deployed_commit`), frontends via `/version.json` (`commit`, cache-busted). Each half is checked against its own repo's HEAD, and the run fails loudly if any environment is behind.

`deployed_commit` is exposed on the public status endpoint precisely because it is reachable on every environment (the backend always answers under `/api`, even on staging where `/` is the frontend). Frontend URLs checked: dev at `https://samar.webority.dev/version.json`, staging at `https://qcisamartest.qci.org.in/version.json`.

## Development Deployment (VM, Entra ID SSH)

```bash
# Full deploy (rsync + composer + cache + migrate + perms + reload)
./deploy/deploy-dev.sh

# Run migrations only
./deploy/deploy-dev.sh migrate

# Rebuild caches only
./deploy/deploy-dev.sh cache

# Health check only
./deploy/deploy-dev.sh verify
```

### What it does
1. Checks Azure CLI login, mints a short-lived Entra ID SSH certificate (`az ssh config`)
2. Rsyncs the repo to `/data/www/samar-api.webority.dev` (excludes vendor, .git, caches)
3. Remote pipeline: `composer install` (skipped when `composer.lock` unchanged), Laravel cache rebuild under `APP_ENV=development`, `php artisan migrate --force`, ownership + SGID permission normalization, php-fpm + nginx reload
4. Verifies `/api/health` — direct against the origin IP, then via the public URL

### Prerequisites
- Azure CLI installed and logged in (`az login`) with access to `Webority-Azure-Subscription-CSP` (Entra ID grants VM login — no PEM)
- `rsync` + `ssh` on PATH (Git Bash on Windows has both)

### Server Details (Development)

| Property | Value |
|----------|-------|
| VM | `vm-webhost-dev-cin-01` (RG `WEBORITYWEBHOSTING-DEV`, Central India) |
| IP (also egress for whitelisting) | 20.204.69.31 |
| Backend Path | /data/www/samar-api.webority.dev |
| Frontend Path | /data/www/samar.webority.dev/build (nginx document root, static) |
| Database | MySQL 8.0 (local) — `qci_samar_development` / user `qci_samar` |
| TLS | API: Let's Encrypt (direct, not CF-proxied — mobile apps pin ISRG roots); Web: Cloudflare-proxied, shared `*.webority.dev` origin cert |

### Manual SSH Access (Development)

```bash
az ssh vm -n vm-webhost-dev-cin-01 -g WEBORITYWEBHOSTING-DEV
```

### If composer.lock is outdated
```bash
composer update --no-dev
./deploy/deploy-dev.sh
```

## Staging Deployment (SSH)

```bash
# Deploy both frontend + backend
./deploy/deploy-staging.sh

# Deploy only frontend
./deploy/deploy-staging.sh frontend

# Deploy only backend
./deploy/deploy-staging.sh backend

# Run migrations only
./deploy/deploy-staging.sh migrate

# Full deploy + fresh database (WARNING: deletes all data)
./deploy/deploy-staging.sh fresh

# Rebuild caches only
./deploy/deploy-staging.sh cache

# Health check
./deploy/deploy-staging.sh verify
```

### Prerequisites
- PEM file in one of these locations:
  - `deploy/zed-staging-server-2026.pem`
  - `~/.ssh/zed-staging-server-2026.pem`
- Frontend repo cloned as sibling: `../qci-samar-web/`
- Node.js and npm (for frontend build)

### Server Details

| Property | Value |
|----------|-------|
| IP | 13.232.227.197 |
| User | ubuntu |
| Domain | https://qcisamartest.qci.org.in |
| Frontend Path | /var/www/qci-samar/frontend |
| Backend Path | /var/www/qci-samar/backend |
| Database | MySQL (local) - qci_samar |

### Manual SSH Access

```bash
ssh -i deploy/zed-staging-server-2026.pem ubuntu@13.232.227.197
```

### nginx & Security Headers (Staging) — server-managed

Staging nginx is **server-managed**, not applied by `deploy-staging.sh` (which only reloads nginx). The live site config is `/etc/nginx/sites-enabled/qci-samar.conf` on the VM; it serves both the React frontend and the Laravel API and `include`s the security-header snippet at `/etc/nginx/snippets/qci-security-headers.conf`.

The **canonical header set is tracked in the repo** at `deploy/nginx/qci-security-headers.conf` (the source of truth). The repo's `qci-samar-web/public/nginx.conf` is a **container** config (port 80, `more_clear_headers`) and does **not** apply to this VM.

**Which layer owns which response** — nginx owns everything it serves directly; Laravel owns `/api`:

- The snippet is `include`d **per-location only** (`/`, static assets, `/images/`, `/storage/`, `/docs`, `/api/documentation`) — deliberately **not** at the server level. A server-level include is inherited by `location ^~ /api/` and the PHP handler, which then send nginx's frontend headers *on top of* the ones `app/Http/Middleware/SecurityHeaders.php` already sets, producing duplicated and conflicting `Content-Security-Policy` / `Permissions-Policy` on every API response.
- Because nginx drops all inherited `add_header`s in any location that sets its own, each of those locations must carry the `include` itself.
- API responses therefore get Laravel's stricter set (`default-src 'none'`, `camera=()`, COEP `require-corp`); the frontend gets nginx's (`default-src 'self'`, `camera=(self)`).

Verify after any change — every count must be exactly 1:

```bash
for u in / /api/v1/system/status /docs; do
  curl -s -D - -o /dev/null "https://qcisamartest.qci.org.in$u" \
    | grep -ci '^content-security-policy:'
done
```

**Direct-IP access is blocked** by `deploy/nginx/00-default-deny.conf` (on the VM at `/etc/nginx/sites-available/`, symlinked into `sites-enabled`): a `default_server` catch-all returning 444 on port 80 and `ssl_reject_handshake on` on 443. Without it nginx falls back to the first server block and serves the whole application over the raw IP. Port 80 must stay open — Let's Encrypt renews over HTTP-01 (`authenticator = nginx`).

To change the headers:

```bash
scp -i deploy/zed-staging-server-2026.pem deploy/nginx/qci-security-headers.conf ubuntu@13.232.227.197:/tmp/
ssh -i deploy/zed-staging-server-2026.pem ubuntu@13.232.227.197 \
  'sudo cp /tmp/qci-security-headers.conf /etc/nginx/snippets/ && sudo nginx -t && sudo systemctl reload nginx'
```

Rollback (a pre-change backup is kept on the VM): `sudo cp /etc/nginx/sites-enabled/qci-samar.conf.bak-pre-headers /etc/nginx/sites-enabled/qci-samar.conf && sudo nginx -t && sudo systemctl reload nginx`.

### Useful Server Commands

```bash
# Check Laravel logs
tail -f /var/www/qci-samar/backend/storage/logs/laravel-*.log

# Restart services
sudo systemctl restart php8.4-fpm nginx

# Check service status
sudo systemctl status php8.4-fpm nginx mysql

# Rebuild caches
cd /var/www/qci-samar/backend && export APP_ENV=staging
php artisan config:cache && php artisan route:cache
```

### Database Credentials (Staging)

Not duplicated here. The live values are the `DB_*` keys in `.env.staging`, which the layered
env loader merges on staging:

```bash
grep '^DB_' .env.staging
```

### Default Users (after fresh seed)

Seeded accounts and their passwords are defined in `database/seeders/` — read them there;
`fresh` re-creates exactly that set.

## Troubleshooting

### API returns 500 error
```bash
ssh -i deploy/zed-staging-server-2026.pem ubuntu@13.232.227.197 \
  "tail -50 /var/www/qci-samar/backend/storage/logs/laravel-*.log"
```

### Permission errors
```bash
ssh -i deploy/zed-staging-server-2026.pem ubuntu@13.232.227.197 \
  "sudo chown -R ubuntu:www-data /var/www/qci-samar/backend && \
   sudo chmod -R 755 /var/www/qci-samar/backend && \
   sudo chmod -R 775 /var/www/qci-samar/backend/storage /var/www/qci-samar/backend/bootstrap/cache"
```

### Config not updating
```bash
ssh -i deploy/zed-staging-server-2026.pem ubuntu@13.232.227.197 \
  "cd /var/www/qci-samar/backend && export APP_ENV=staging && \
   php artisan config:clear && php artisan config:cache"
```

### composer.lock out of sync
```bash
composer update --no-dev
# Then re-run the deployment
```

## Capacity and background processing

Set up once per server; the pipelines keep it current afterwards.

### Queue workers and scheduler (installed by the pipelines)

Emails on status changes, the committee close-out (MoM / certificate / report
PDFs and decision emails) and Business Central pushes run on a queue worker, not
inside web requests. Every deploy runs `deploy/remote/install-workers.sh`, which:

- installs `deploy/supervisor/qci-samar-worker.conf` (2 `queue:work` processes) when
  supervisor is present — install it once with `sudo apt install supervisor`;
- installs the scheduler cron (`deploy/cron/qci-samar-scheduler`) unless a user
  crontab already runs `schedule:run`;
- restarts the workers so they load the new code.

Required in each server's `.env.{environment}` (they are deliberately not left to
the base `.env`):

```
QUEUE_CONNECTION=database
RATE_LIMIT_ENABLED=true
LOG_CHANNEL=daily
LOG_LEVEL=warning
```

The deploy prints a warning while `QUEUE_CONNECTION` is still `sync`; in that mode
everything still works, but the slow work runs inside the request again.

### Server tuning (apply by hand, sized to the VM)

| File | Install to | Notes |
|---|---|---|
| `deploy/php/qci-samar-fpm-pool.conf` | `[www]` pool in `/etc/php/8.4/fpm/pool.d/www.conf` | Size `pm.max_children` from measured worker memory (formula in the file) |
| `deploy/php/qci-samar-opcache.ini` | `/etc/php/8.4/fpm/conf.d/99-qci-samar-opcache.ini` | `validate_timestamps=0` relies on the deploy's php-fpm reload |
| `deploy/php/qci-samar-uploads.ini` | `/etc/php/8.4/fpm/conf.d/99-qci-samar-uploads.ini` | Request-size limits |
| `deploy/mysql/qci-samar.cnf` | `/etc/mysql/mysql.conf.d/zz-qci-samar.cnf` | Buffer pool, connections, slow-query log; restart MySQL in a quiet window |
| `deploy/nginx/qci-samar.conf` | live site config | Body buffering, timeouts, `/_protected_files/` |

After the `/_protected_files/` location is live, set `FILES_X_ACCEL_REDIRECT=true`
so nginx (not PHP) sends photo and document downloads.

### Growing tables

`records:prune-stale` (daily, 02:15) deletes ended login sessions older than
`SESSION_PRUNE_AFTER_DAYS` (7) and email delivery records older than
`MAIL_EVENTS_RETENTION_DAYS` (180). Audit logs keep their own 730-day cleanup.

### Scaling past one VM

The app still keeps uploads (`storage/app/private`), the cache and MySQL on the
same machine. Before adding a second app server: move uploads to S3-compatible or
Azure Blob storage, use Redis for `CACHE_STORE` and the queue, and run MySQL as a
managed instance.
