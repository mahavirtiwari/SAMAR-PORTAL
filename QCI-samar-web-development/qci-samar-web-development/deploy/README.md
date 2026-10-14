# QCI SAMAR Web — Deployment

This repo deploys the **frontend only**. Staging is driven from the backend repo (see below).

| Environment | Command | Target | URL |
|---|---|---|---|
| **Development** | `./deploy/deploy-dev.sh` (this repo) | `vm-webhost-dev-cin-01` → `/data/www/samar.webority.dev/build` | https://samar.webority.dev |
| **Staging** | `../qci-samar-backend/deploy/deploy-staging.sh frontend` | `qci-staging-vm` → `/var/www/qci-samar/frontend` | https://qcisamartest.qci.org.in |
| **Production** | — | not provisioned | — |

> Deploying **both** repos to **both** environments in one go is the unified command in the backend repo:
> `../qci-samar-backend/deploy/deploy.sh` (see `qci-samar-backend/deploy/README.md`).

## Development

```bash
./deploy/deploy-dev.sh          # build:development → rsync → verify
./deploy/deploy-dev.sh verify   # health check only
./deploy/deploy-dev.sh help
```

### What it does
1. Mints a short-lived Entra ID SSH certificate via `az ssh config` (no PEM).
2. `npm run build:development`, asserting `build/index.html` exists afterwards.
3. Rsyncs `build/` to `/data/www/samar.webority.dev/build` with `--delete`.
4. Verifies the origin directly (via `--resolve` against the VM IP) and then the public URL through Cloudflare.

There is no application process to restart: nginx serves `build/` as static files,
the same way staging does. `/etc/nginx/sites-enabled/samar.webority.dev` sets the
document root, caches `/assets/` immutably, 404s a missing hashed asset rather
than falling back to `index.html`, and includes
`/etc/nginx/snippets/samar-security-headers.conf` — the dev twin of
`qci-samar-backend/deploy/nginx/qci-security-headers.conf`, identical to it apart
from `connect-src`.

Only build output belongs in that directory: it is the document root, so anything
else put there is published to the internet. [BUG-07226]

### Prerequisites
- Azure CLI logged in (`az login`) with access to `Webority-Azure-Subscription-CSP`
- `rsync` + `ssh` on PATH (Git Bash on Windows has both)
- Node.js and npm

## Staging

Staging is **not** deployed from this repo. The backend repo's script builds this repo's
frontend (`npm run build:staging`) and ships it, so both halves stay on one commit:

```bash
cd ../qci-samar-backend
./deploy/deploy-staging.sh frontend   # frontend only
./deploy/deploy-staging.sh            # frontend + backend
```

## Environment configuration

No `.env` files. `scripts/prebuild.js` merges `src/appsettings.json` (base) with
`src/appsettings.{ENV}.json` into the git-ignored `src/appsettings.Compiled.json`.
The `build:*` scripts run prebuild for you; run it manually before invoking `vite` directly.

`src/appsettings.Production.json` has an empty `BASE_URL` — production is not provisioned,
and a production build would fail at runtime until the API host is set.

## Credentials

Not recorded here. Server/database values live in the backend repo's `.env.staging` /
`.env.development` (`DB_*`), which the layered env loader merges per environment. Seeded
test accounts come from `qci-samar-backend/database/seeders/`.

## Troubleshooting

```bash
# dev is static nginx — there is no application process to inspect
az ssh vm -n vm-webhost-dev-cin-01 -g WEBORITYWEBHOSTING-DEV
sudo tail -f /var/log/nginx/error.log
ls -l /data/www/samar.webority.dev/build   # confirm the build actually landed

# staging is static nginx too — check nginx logs on that VM
```
