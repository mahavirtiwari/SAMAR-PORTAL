@~/.claude/conventions/react.md
@~/.claude/conventions/infra-map.md
@~/.claude/conventions/monitoring.md
@~/.claude/conventions/pm.md
@~/.claude/conventions/mcp-usage.md

**Tech:** React 19, Vite 7, React Router 7, Redux Toolkit + React-Redux, MUI v7 (+ MUI X Data Grid / Charts / Date Pickers), React Bootstrap 5, Formik + Yup, Axios + axios-retry, Recharts, dayjs, SCSS (sass). No TypeScript in src — JS/JSX only; TypeScript present only for Playwright/tooling. Lint/format via **Biome** (`biome.json`) — not ESLint/Prettier. Path alias `@` → `src/`.

**What it is:** Admin/operations web frontend for the QCI SAMAR assessment scheme. Screens cover assessor management, assessment workflows, scheduling, and reporting. State managed via Redux slices (`src/redux/slices/`, `src/redux/action/`, store in `src/redux/store.js`); API calls via Axios services in `src/services/`; page layouts in `src/screens/`.

**One role per user — an intended constraint, not a bug.** The whole UI (sidebar menu, route resolution, landing page, header badge) keys off a single role, read as `user.roles[0].slug` in `Sidebar.jsx`, `UserNavigator.jsx` and `ApplicationNavigator.jsx`. The backend returns *all* active roles as an array, so a user assigned two roles would silently surface only the first one the API happened to list. This is accepted: SAMAR users hold one role. Do not "fix" it by honouring more of the array — the app has no role-switcher and no rule for which role wins, so a partial change would make behaviour depend on array order. If genuine multi-role users ever become a requirement, that is a scoped feature (role switcher + which-menu/which-dashboard decisions), decided as its own piece of work. Until then the correct guard is to not assign a second role.

**Commands:**
- `npm run dev` — local (uses `appsettings.Local.json`)
- `npm run dev:development` — dev environment
- `npm run build:staging` / `npm run build:production` — env-targeted builds
- `npm run test:e2e` — Playwright end-to-end tests
- `npm run lint` — Biome lint on `src/`
- `npm run format:check` / `npm run format` — Biome format check / write
- `npm run check` / `npm run check:fix` — Biome lint + format + imports (check / auto-fix)

**Config system:** No `.env` files. `scripts/prebuild.js` merges `src/appsettings.json` (base) + `src/appsettings.{ENV}.json` (override) → writes `src/appsettings.Compiled.json` (git-ignored runtime artifact). Always run prebuild before `vite` manually. Available env files: `Local`, `Development`, `Staging`, `Production`.

**Environments (API base URLs):**
- Development: `https://samar-api.webority.dev/api/v1`
- Staging: `https://samar-staging1.qci.org.in/api/v1`
- Production: **unset** — `src/appsettings.Production.json` has `BASE_URL: ""`; the production API host is not yet decided. Set it before any prod build/deploy (an empty base URL will fail at runtime).

**4-repo system:**
| Repo | Role |
|---|---|
| `../qci-samar-backend` | Laravel API — source of truth for all endpoint contracts and auth flows |
| `../qci-samar-assessor-mobile` | React Native mobile client for assessors |
| `../qci-samar-applicant-mobile` | React Native mobile client for applicants |
| this repo | Web admin/ops frontend |

**Rule:** Any change that touches an API contract (endpoint path, request shape, response shape, auth header) must be checked against all four repos. Backend changes land first; frontend and both mobile apps follow.

The `*-old` sibling directories are retired — ignore them.

**Known deviation from the fleet UI convention — accepted debt.** `react.md` fixes the fleet on Bootstrap 5.3 + react-bootstrap and prohibits MUI, and calls `src/assets/theme/` the retired MUI-era location. This repo deviates: it has a first-class MUI v7 footprint (Data Grid, Charts, Date Pickers) alongside react-bootstrap, and it does have `src/assets/theme/`. This is a conscious, accepted deviation — not drift to be silently "corrected". Do not rip MUI out opportunistically; match whatever the surrounding screen already uses, and raise a migration as its own scoped decision if it ever becomes worth doing.

**Known deviation from the fleet version-marker contract: accepted.** `react.md` specifies `public/version.json` as `{ "version": "<sha>-<epochMs>-<app>", "environment", "builtAt" }` plus a `public/_version.txt`. This repo predates that contract and uses `{ version, buildTime, commit }`: `buildTime` drives the update-detection reload (`verify-build.js` asserts it is baked into the bundle) and `commit` drives the deploy parity check in `../qci-samar-backend/deploy/deploy.sh`. Both consumers are wired to this shape, so do not "fix" it to the fleet shape opportunistically; migrating is its own scoped decision that must move `verify-build.js`, `useVersionCheck`-equivalent polling, and the parity extraction together.

**Known deviation from the fleet formatter location: accepted.** `react.md` names `src/lib/format.js` as the one locale/formatter module. This repo keeps it at `src/utils/formatters.js`, imported from more than a hundred files. Add new formatters there; moving the module is its own scoped decision.

**Prohibited without approval:** production deployments, editing `package.json` scripts/deps without discussion, switching the config-compilation strategy.
