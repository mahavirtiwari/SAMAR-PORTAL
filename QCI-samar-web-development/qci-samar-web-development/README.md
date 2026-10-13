# QCI SAMAR — Web

Admin and operations frontend for QCI's SAMAR assessment scheme: assessor management,
assessment workflows, scheduling, and reporting.

React 19 + Vite 7, JavaScript only (no TypeScript in `src`). See [CLAUDE.md](CLAUDE.md) for
architecture and conventions.

## Prerequisites

- Node.js and npm

## Running locally

```bash
npm install
npm run dev                 # Local config
npm run dev:development     # against the development API
npm run dev:staging         # against the staging API
```

Every `dev:*` / `build:*` script runs `prebuild` first — it compiles the environment config.
Invoking `vite` directly reuses whatever config was last compiled.

## Building

```bash
npm run build:development
npm run build:staging
npm run build:production    # see the Production note below
```

Output goes to `build/`, which is exactly what gets deployed — nginx serves that
directory as the document root on every environment. Nothing else may be copied
into it: whatever sits there is published to the internet. [BUG-07226]

## Configuration

No `.env` files. `scripts/prebuild.js` merges `src/appsettings.json` (base) with
`src/appsettings.{Local,Development,Staging,Production}.json` into
`src/appsettings.Compiled.json` (git-ignored).

| Environment | API base URL |
|---|---|
| Development | `https://samar-api.webority.dev/api/v1` |
| Staging | `https://samar-staging1.qci.org.in/api/v1` |
| Production | **unset** — not provisioned |

**Production is not provisioned.** `src/appsettings.Production.json` has an empty `BASE_URL`,
so `build:production` compiles and then fails at runtime. Tracked in TASK-05597.

## Tests

```bash
npm run test:e2e            # Playwright
npm run test:e2e:ui         # interactive runner
```

## Deployment

```bash
./deploy/deploy-dev.sh      # dev: build → rsync → pm2 restart → verify
```

Staging deploys from the backend repo, so API and frontend ship from one commit:

```bash
cd ../qci-samar-backend && ./deploy/deploy-staging.sh frontend
```

Details in [deploy/README.md](deploy/README.md).

## Related repos

`../qci-samar-backend` (API — contract source of truth) · `../qci-samar-assessor-mobile` ·
`../qci-samar-applicant-mobile`. API contract changes land in the backend first.
