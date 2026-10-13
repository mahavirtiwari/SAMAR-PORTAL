# QCI Samar Backend

@~/.claude/conventions/php.md
@~/.claude/conventions/infra-map.md
@~/.claude/conventions/monitoring.md
@~/.claude/conventions/pm.md
@~/.claude/conventions/mcp-usage.md

## Project Context

- **Type**: Laravel 12 REST API (QCI certification for defense/aerospace)
- **Version**: `APP_VERSION` in `.env` (single source of truth); `config/app.php` reads it into `api_version`, surfaced at `/api/health` and the `X-Api-Version` header
- **Auth**: JWT (access + refresh tokens)
- **Docs**: `docs/` folder only (never project root). See `docs/INDEX.md`
- **Deploy**: `deploy/` folder. See `deploy/README.md`
- **Scripts**: `scripts/` holds one-off maintenance scripts (run manually, not part of any pipeline)
- **Swagger**: http://localhost:8000/api/documentation (contact: support@webority.com)

## 4-repo system — check siblings before touching API contracts

- This repo — Laravel API: source of truth for endpoints, request/response shapes, roles
- `../qci-samar-web` — React web frontend
- `../qci-samar-assessor-mobile` — React Native offline-first mobile client (assessors)
- `../qci-samar-applicant-mobile` — React Native mobile client (applicants)

Any change to an endpoint, request/response shape, role enum, or DB field name must be reviewed against all four repos — land it here first, then reflect in web and both mobile apps.

The `*-old` sibling directories (`qci-samar-backend-old`, `qci-samar-web-old`, `qci-samar-assessor-mobile-old`) are retired — ignore them.

### Roles (9)

System Admin, DRDO Admin, DRDO Lab, Operations Manager, Operations Admin, Assessor, Unit Admin, Enterprise Admin, ERP Integration

Seeded by `database/seeders/RoleSeeder.php` (slugs are `Role::` constants) — that file is the source of truth. `ERP Integration` is the machine role for the Business Central push, not a human role. `committee_member` is an entity, not a role.

### Laravel Standards

- Prefer Eloquent for CRUD; Query Builder for complex joins/aggregations
- Use relationships over manual joins
- Let validation errors bubble via FormRequest; try-catch only for external calls/file ops/DB transactions
- Log: `error()` for exceptions, `info()` for business events, `debug()` for dev. Never log PII
- Migrations: always include `down()`, proper column types, indexes on FKs

## Deployment — direct, never delegated

Deploy yourself via the scripts; never spawn a deployment subagent:

- Dev: `bash deploy/deploy-dev.sh`
- Staging: `bash deploy/deploy-staging.sh`

Deploys (dev and staging) wait for an explicit ask — never deploy automatically after a push.

## Proactive Actions (do without asking)

- Run tests after any implementation
- Swagger regeneration after API changes
- Config cache clearing after config changes

## Never Do Without Explicit Request

- Commit or push code
- Create unnecessary new files
- Refactor unrequested code
- Add features during audits/sweeps — language, UX, and code-quality passes report findings; they never add screens, routes, endpoints, or menu entries

## Testing

- Command: `php artisan test`
- Run after every implementation, bug fix, code modification, and before commits
- On failure: identify root cause, fix, re-test. Never commit with failing tests
- New endpoints need feature tests; auth needs role scenario tests

### Requires MySQL — run on the dev VM if the machine has none

The suite uses MySQL (`RefreshDatabase` against `qci_samar_test`), not SQLite, so it
cannot run on a machine without a local MySQL. The dev VM has a `qci_samar_test`
database granted to the `qci_samar` user for this. To run there:

```bash
# from the repo root, with az CLI logged in
az ssh config --file /tmp/sshcfg -n vm-webhost-dev-cin-01 -g WEBORITYWEBHOSTING-DEV \
  --subscription "Webority-Azure-Subscription-CSP" --overwrite
ssh -F /tmp/sshcfg 20.204.69.31 'rm -rf /tmp/qci-test && mkdir -p /tmp/qci-test'
rsync -az --exclude vendor/ --exclude node_modules/ --exclude .git/ --exclude storage/app/ \
  -e "ssh -F /tmp/sshcfg" ./ 20.204.69.31:/tmp/qci-test/
ssh -F /tmp/sshcfg 20.204.69.31 'cd /tmp/qci-test \
  && mkdir -p storage/framework/{cache/data,sessions,views} storage/logs bootstrap/cache \
  && composer install --no-interaction --no-progress -q \
  && sed -i "s|^DB_USERNAME=root|DB_USERNAME=qci_samar|; s|^DB_PASSWORD=$|DB_PASSWORD=<.env.development password>|" .env.testing \
  && php artisan test'
```

`.env.testing` assumes a local MySQL root with no password, which is why the sed is
needed. Work in `/tmp/qci-test` — never run the suite against the deployed app
directory, and never against `qci_samar_development`.

## Git

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- One commit per logical change, only when tests pass
- Branch: work on `development` exclusively. No PRs (per global CLAUDE.md).
