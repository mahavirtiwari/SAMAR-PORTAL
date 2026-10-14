@~/.claude/conventions/react-native.md
@~/.claude/conventions/infra-map.md
@~/.claude/conventions/monitoring.md
@~/.claude/conventions/pm.md
@~/.claude/conventions/mcp-usage.md

**Identity:** QCI SAMAR Assessor — bare React Native 0.86 (not Expo) mobile app for QCI's SAMAR assessment scheme. Assessors punch in/out with selfie + geolocation, record responses to assessment parameters, capture site pictures and site-tour evidence via camera, and hold opening/closing meetings. Roles: lead assessor vs co-assessor, resolved via `src/utils/teamRole.js`. All data is written offline-first to SQLite (`react-native-sqlite-storage`) and synced when connectivity returns. Key build commands (always run `npm run prebuild` first, which merges `appsettings.json` + `appsettings.<ENV>.json` into `appsettings.Compiled.json` and patches native files):
- **Android dev:** `npm run android:development`
- **Android staging APK:** `npm run android:stagingApk`
- **iOS dev:** `npm run ios:development`
- **Run Metro separately:** `npx react-native start` (there is no `start` npm script in this repo)
- **Lint/format:** Biome only (`npm run lint` / `npm run check` / `npm run format`) — not ESLint/Prettier

**4-repo system — check all four before touching API contracts:**
- `../qci-samar-assessor-mobile` — this repo (assessor mobile client)
- `../qci-samar-backend` — Laravel API (source of truth for endpoints, request shapes, roles)
- `../qci-samar-web` — React web frontend (same API, different surface)
- `../qci-samar-applicant-mobile` — applicant mobile client (same offline-first architecture, applicant-facing domain)

Rule: any change to an API endpoint, request/response shape, role enum, or DB field name must be reviewed and landed in `qci-samar-backend` first, then reflected here and in the other clients.

The `*-old` sibling directories are retired — ignore them.

**Offline-first architecture:**
- SQLite via `react-native-sqlite-storage`; schema managed by versioned migrations in `src/services/database/migrations/` (keyed off SQLite `user_version` pragma; add a file + register in `migrations/index.js` — runner picks it up on next launch).
- All write operations (punchIn, punchOut, responses, site pictures, meeting records) go to an outbox table (`outboxRepo`) first; `src/services/offline/syncEngine.js` drains the outbox FIFO when online — server endpoints are expected idempotent, `clientUuid` used for deduplication.
- Read path: `src/services/offline/readGate.js` gates reads from local SQLite; download happens via `src/services/offline/downloadAssessment.js`.
- Photo evidence stored under `DocumentDirectoryPath/assessments/...` (durable across app restarts); paths serialised into outbox payloads.

**Environments — config files, not secrets:**
- Config chain: `appsettings.json` (base) + `appsettings.<ENV>.json` (override) → merged by `prebuild.js` into `appsettings.Compiled.json` (gitignored output); imported by `appsettings.js` at the repo root (not under `src/`).
- Three environment files at root: `appsettings.Development.json`, `appsettings.Staging.json`, `appsettings.Production.json`.
- Dev API host: `samar-api.webority.dev`
- Staging API host: `qcisamartest.qci.org.in`
- Each env file carries `BASE_URL`, `LOGGING_ENABLED`, `LOG_LEVEL`.
- **There is no production backend, and `Production` here does not mean one.** `appsettings.Production.json` deliberately carries the **staging** `BASE_URL` (`https://qcisamartest.qci.org.in/api/v1/`) so that store builds work — see [D-007](../qci-samar-backend/docs/10-architecture/D-007-mobile-store-release-runs-on-staging.md). Read `Production` as "the config a store build ships with". `APP_ID_SUFFIX` is `""` there, so the binary is the real `org.qcin.samar.assessor`, not the `.staging` internal build. This first store release is a **pilot**: the stores are a distribution channel for testing, staging keeps its testing posture (no backups, `deploy-staging.sh fresh` still wipes it), and the apps are released **again** against the real production backend once one exists. Pilot users and internal staging testing share the `qci_samar` database.
- `PASSWORD_SECRET_KEY` was removed from every env file and from `appsettings.js` (20-Aug-2026). It was a leftover from the retired app's client-side password encryption: nothing in `src` read it, it was identical across staging and production, and it shipped inside the store binary. This client sends the password over TLS without client-side encryption.
- Both SAMAR apps pin — the applicant app was brought to the same posture on 20-Aug-2026, superseding D-008 which had briefly recorded it as deliberately unpinned.
- **Certificate pins are NOT configured here.** These files once carried `API_DOMAIN` / `CERTIFICATE_PINS` keys that nothing read — no JS, no `prebuild.js`, no native file consumed them, so editing them silently did nothing. They have been removed; pinning is configured only in the native files below.

**TLS certificate pinning is enforced natively — read before touching any cert or domain:**
- Android: `android/app/src/main/res/xml/network_security_config.xml`. iOS: TrustKit in `ios/assessor/AppDelegate.swift` with `kTSKEnforcePinning: true`.
- **These two files are the only place pinning is configured** — pins are hardcoded there, not driven by `appsettings.*.json`. Provisioning production means editing both: the Android file's production `<domain-config>` block is still commented out with `PRODUCTION_DOMAIN` / `PRODUCTION_LEAF_HASH` placeholders, and `AppDelegate.swift` has no production entry at all.
- Pins target **root** certificates (not leaves), so routine leaf renewals don't break installed builds: the ISRG roots for `samar-api.webority.dev` (Let's Encrypt) and the GoDaddy roots (TLS Root CA - R1 and Root G2) for staging `qcisamartest.qci.org.in`, which serves QCI's `*.qci.org.in` GoDaddy wildcard.
- **Rotating the API certificate to a different root, or changing the API domain, bricks every installed pinned build** — it must ship in lockstep with an app release. There is no server-side hotfix.

**Signing-cert hashes are CONSTANTS, never runtime-derived.** `SecurityGuard.kt` holds `RELEASE_CERT_SHA256` / `PLAY_CERT_SHA256`, and `initTalsec()` reads them via `SecurityGuard.expectedCertHashes()`. Until 20-Aug-2026 Talsec derived its hashes from the installed package at runtime, which made the integrity layer **defeated by construction** — a re-signed APK produces its own hash and satisfies its own comparison. The constants are currently `UNSET` (fresh keystores pending, D-009): while unset the signature check is skipped and logs an error every launch, root/tamper detection still enforces, and **filling them is a pre-submission gate**.

**Store release:** `docs/40-release/store-release.md` — Play Store / App Store submission, the review-account contract (one shared account, `is_two_factor_enabled=false` to skip OTP), review-notes text, pre-submission checklist. Read it before building any store artifact.

**Canonical patterns other sessions should reference from this repo:**
- **Permissions (camera + location):** `src/utils/permissions.js` — `ensurePermission(type)`, blocked-permission Alert + Settings deep-link pattern. This is the single source of truth; all screen-level permission calls go through it. Permissions are requested **in context at first capture, never as a login gate** — the login-screen gate was removed on 20-Aug-2026 because a reviewer or user who declined either prompt met a Login button that could never be enabled (Apple 5.1.1 shape). Do not reinstate it. The disk-space check still gates login, deliberately.
- **Team role resolution (lead vs co-assessor):** `src/utils/teamRole.js` — `isLead` derived from `assessment.leadAssessor.id` vs current user or `me.role === 'lead_assessor'`.
- **Offline outbox / sync:** `src/services/offline/syncEngine.js` + `src/services/database/repositories/outboxRepo.js` — FIFO drain, idempotent server calls, `markSyncing`/`markSynced`/`markFailed` state machine.
- **Punch flow (shared hook):** `src/screens/user/assessment/shared/usePunchFlow.js` — reused by punch-in and punch-out screens.
