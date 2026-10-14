@~/.claude/conventions/react-native.md
@~/.claude/conventions/infra-map.md
@~/.claude/conventions/monitoring.md
@~/.claude/conventions/pm.md
@~/.claude/conventions/mcp-usage.md

**Identity:** QCI SAMAR Applicant — bare React Native 0.86 (not Expo) mobile app for QCI's SAMAR assessment scheme. Applicants view their applications and capture site evidence: site pictures and site-tour photos. Display name "SAMAR Applicant", app id `org.qcin.samar.applicant`. Data is written offline-first to SQLite and synced when connectivity returns.

**Stack:** React Native 0.86.2, React 19.2.8, JavaScript only (no `.ts`/`.tsx` in `src` — the `tsconfig.json` is editor tooling). React Navigation 7 (`native` + `native-stack`), Redux Toolkit + React-Redux, Axios + axios-retry, `react-native-sqlite-storage`.

**4-repo system — check all four before touching API contracts:**
- `../qci-samar-applicant-mobile` — this repo (applicant mobile client)
- `../qci-samar-backend` — Laravel API (source of truth for endpoints, request shapes, roles)
- `../qci-samar-web` — React web admin/ops frontend
- `../qci-samar-assessor-mobile` — assessor mobile client (same offline-first architecture, assessor-facing domain)

Rule: any change to an API endpoint, request/response shape, role enum, or DB field name must be reviewed and landed in `qci-samar-backend` first, then reflected here and in the other clients.

The `*-old` sibling directories are retired — ignore them.

**Commands** (every env-targeted build runs `prebuild` first — it must, or the app ships the previous env's config):
- **Android dev:** `npm run android:development`
- **Android staging APK:** `npm run android:stagingApk`
- **iOS dev:** `npm run ios:development`
- **Run Metro separately:** `npm start`
- **Lint/format:** Biome only (`npm run lint` / `npm run check` / `npm run format`) — not ESLint/Prettier
- `npm run android` is an alias for `android:staging`.
- `npm run android:debug`, `ios`, `ios:dev`, `ios:debug`, `ios:release`, and `android:release` run `prebuild.js --same-env`: they recompile (and re-stamp the commit) for whatever environment was LAST compiled, without switching env or touching native files. Use an env-targeted script to change environment.

**Environments — config files, not secrets:**
- Config chain: `appsettings.json` (base) + `appsettings.<ENV>.json` (override) → merged by `prebuild.js` into `appsettings.Compiled.json` (generated, gitignored) → imported by `appsettings.js` at the repo root (not under `src/`). `prebuild.js` also patches `android/gradle.properties` and the iOS `Info.plist`, and writes Fastlane env files.
- `NODE_ENV` selects the override and defaults to **Staging** when unset.
- Dev API: `https://samar-api.webority.dev/api/v1/`
- Staging API: `https://qcisamartest.qci.org.in/api/v1/`
- **There is no production backend, and `Production` here does not mean one.** `appsettings.Production.json` deliberately carries the **staging** `BASE_URL` (`https://qcisamartest.qci.org.in/api/v1/`) so that store builds work — see [D-007](../qci-samar-backend/docs/10-architecture/D-007-mobile-store-release-runs-on-staging.md). Read `Production` as "the config a store build ships with". `APP_ID_SUFFIX` is `""` there, so the binary is the real `org.qcin.samar.applicant`, not the `.staging` internal build. This first store release is a **pilot**: the stores are a distribution channel for testing, staging keeps its testing posture (no backups, `deploy-staging.sh fresh` still wipes it), and the apps are released **again** against the real production backend once one exists. Pilot users and internal staging testing share the `qci_samar` database.
- Each env file carries `ENVIRONMENT`, `APP_ID_SUFFIX`, `BASE_URL`, `LOGGING_ENABLED`, `LOG_LEVEL`.

**Security-grade app — the layers apply together, never selectively.** This is a DRDO-scheme client capturing geo-tagged site evidence, so it carries the full `react-native.md` security-grade tier like its sibling: `SecurityGuard.kt` (Kotlin baseline checks + RootBeer, fail-closed) enforced from `MainApplication.onCreate` and `MainActivity.onResume`, Talsec, WebView debugging off unconditionally, the iOS anti-debug / jailbreak / Frida layer, and TrustKit pinning against the ISRG roots. D-008 briefly recorded this app as deliberately unpinned; it was **superseded the same day** — do not reintroduce that asymmetry.

**Signing-cert hashes are CONSTANTS, never runtime-derived.** `SecurityGuard.kt` holds `RELEASE_CERT_SHA256` / `PLAY_CERT_SHA256`. They are currently `UNSET` because this app relaunches under a fresh listing (D-009) and its keystores do not exist yet — while unset, the signature check is **skipped** and logs an error every launch; root/tamper detection still enforces. **Filling them is a pre-submission gate** (`docs/40-release/store-release.md`). Never "fix" an unset hash by deriving it from the installed package: a re-signed APK then satisfies its own derived hash and the check becomes decorative.

**Offline-first architecture:**
- SQLite via `react-native-sqlite-storage`; schema managed by versioned migrations in `src/services/database/migrations/` (`001_outbox`, `002_site_picture_cache`, registered in `index.js`, applied by `runner.js`). `setupDatabase.js` runs at app start from `App.js`.
- Writes go to an outbox table (`src/services/database/repositories/outboxRepo.js`) first; `src/services/offline/syncEngine.js` drains it FIFO when online. Server endpoints are expected idempotent — `clientUuid` is used for deduplication.
- Photo evidence: `src/services/offline/photoStorage.js` + `sitePictureCache.js` (cached via `sitePictureCacheRepo`); capture records go through `recordSitePicture` / `recordSiteTourPicture` (and their `Delete` counterparts) and `pendingCaptures.js`.

**Layout:**
- `src/navigations/` — `ApplicationNavigator.js`, `PublicNavigator.js`, `UserNavigator.js`
- `src/screens/` — `public/Login.js`; `user/Home.js`, `user/application/{ApplicationDetail,SitePictures,SiteTour}.js`, `user/profile/{Profile,Support}.js`
- `src/services/api/` — `accountService.js`, `applicationService.js`, `siteService.js`, and `clients/{publicClient,userClient}.js` (the user client holds the token-refresh interceptor, 401 handling, 503 maintenance-mode detection and offline fail-fast)
- `src/redux/` — `store`, `slices/`, `action/`
- `src/components/` — `assessment`, `base`, `common`, `layout`, `modals`, `shared`
- `src/utils/`, `src/constants/`, `src/assets/`, `src/services/storage/`

**Distribution:** manual (no CI, no Fastlane); store submission in preparation as of 20-Aug-2026. Version lives in `appsettings.json` (`VERSION_DISPLAY` / `VERSION_INTERNAL`) and is applied to native files by `prebuild.js` — never bump it autonomously, Navneet names the number.

**Store release:** `docs/40-release/store-release.md` — Play Store / App Store submission, the review-account contract (one shared account, `is_two_factor_enabled=false` to skip OTP), review-notes text, pre-submission checklist. Read it before building any store artifact.

**Permissions are requested in context, never as a login gate.** `src/utils/permissions.js` → `ensurePermission(type)` re-prompts on denial and deep-links to Settings when blocked; the capture screens call it at first capture. The login-screen gate was removed on 20-Aug-2026 because a reviewer or user who declined either prompt met a Login button that could never be enabled (Apple 5.1.1 shape). Do not reinstate it.

**Relationship to the assessor app:** the two mobile apps share stack, the prebuild config chain, script naming, and the SQLite-outbox/sync design — but they are separate codebases with no shared package. Patterns worth copying live in `../qci-samar-assessor-mobile` (permissions helper, sync engine); domain logic does not transfer (no lead/co-assessor role model here — the applicant is a single role).
