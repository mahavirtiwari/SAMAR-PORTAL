# Store release — SAMAR Applicant

Runbook for publishing `org.qcin.samar.applicant` to the Play Store and the App Store, and for
the sign-in credentials both review teams require.

Decision this rests on: **[D-007 — the first mobile store release is a pilot running against
staging](../../../qci-samar-backend/docs/10-architecture/D-007-mobile-store-release-runs-on-staging.md)**.
Read it before changing anything here. In short: this release distributes the app through the
stores **for testing**; staging keeps its testing posture, and the app is released again
against a real production backend once one exists.

---

## 0. This is a FRESH listing, not an update

Per [D-009](../../../qci-samar-backend/docs/10-architecture/D-009-samar-apps-relaunch-under-org-qcin-namespace.md),
both SAMAR apps relaunch from **1.0.0** under the `org.qcin` namespace, on **QCI's own**
Play Console and Apple Developer accounts (publisher name "Quality Council of India").

- App id, both platforms: **`org.qcin.samar.applicant`** (`.staging` / `.development` for internal builds)
- Store display name: **SAMAR Applicant**
- This app has never been published under any id, so there is no old listing to retire.

Consequences worth holding onto:

- **Both submissions are first submissions.** Full review scrutiny, not an update review.
- **The Play package name is permanent** — it can never be reused on any account, so do not
  submit a throwaway build under it.
- **Confirm the upload key before the first submission.** `android/app/release.jks` has never
  signed a published build; whatever key ships first becomes this listing's upload key
  permanently. **Enable Play App Signing**, so a lost upload key is recoverable rather than
  fatal, and back the keystore up somewhere that is not this repo.
- **Firebase apps exist under `org.qcin.samar.applicant`** (created 20-Aug-2026 in the
  `qci-samar` project, Android + iOS × production/staging/development). `google-services.json`
  and `ios/qciapplicantapp/firebase/GoogleService-Info-*.plist` are checked in and match.


## 1. What a store build is

| | Value |
|---|---|
| Build command | `npm run android:release` / `npm run ios:release` with `NODE_ENV=Production` |
| App id | `org.qcin.samar.applicant` — `APP_ID_SUFFIX` is `""` in Production (internal builds use `.staging`) |
| API | `https://samar-staging1.qci.org.in/api/v1/` — **staging**, per D-007 (pilot) |
| TLS pinning | **none, deliberately** — see [D-008](../../../qci-samar-backend/docs/10-architecture/D-008-applicant-app-does-not-pin-tls.md). Unlike the assessor app, this client configures no pins and wires no pinning library. Do not assume pinning protects it, and do not copy the assessor app's pinning claims here. |
| Version | `appsettings.json` → `VERSION_DISPLAY` / `VERSION_INTERNAL`, stamped into the native files by `prebuild.js` |
| Client logging | off (`LOGGING_ENABLED: false`) |

`prebuild` must run — an env-targeted `npm run` script does it automatically. The
`:release` / `:debug` scripts **skip** prebuild and ship whatever
`appsettings.Compiled.json` already holds. Always build the store artifact from an
env-targeted script, or run it by hand. **`prebuild.js` only patches the native files when `PLATFORM` is set** —
`NODE_ENV=Production node prebuild.js` alone writes `appsettings.Compiled.json` and nothing
else, silently leaving `gradle.properties`, `Info.plist` and the pbxproj on their previous
values. Run it once per platform:

```bash
NODE_ENV=Production PLATFORM=android node prebuild.js
NODE_ENV=Production PLATFORM=ios     node prebuild.js
```

Then check `appsettings.Compiled.json` says `"ENVIRONMENT": "Production"` **and** that
`android/gradle.properties` and the iOS pbxproj (`PRODUCT_BUNDLE_IDENTIFIER`) carry the right
id and version. Note `Info.plist` holds `$(PRODUCT_BUNDLE_IDENTIFIER)` rather than a literal —
Xcode expands it from the pbxproj, so the pbxproj is the value to check.

## 2. Review accounts

Both stores require credentials that let a reviewer see the app working. Neither store
needs (nor asks for) a fake or offline "demo mode", and this app must not ship one — a
hardcoded credential in a DRDO/QCI binary is extractable with `strings`. The reviewer uses
a real account against the real API.

**One shared applicant review account is used by both stores** (Navneet, 20-Aug-2026).

### Why no OTP gets in the way

`AuthService::login()` (`qci-samar-backend/app/Services/Auth/AuthService.php:182`)
short-circuits the entire OTP flow when `users.is_two_factor_enabled` is false — it issues
the JWT directly and never sends an email. That column **defaults to false**, so a review
account needs no code change and no bypass.

If someone later flips 2FA on for this user, the reviewer is stranded waiting for an email
they cannot read. Treat the flag as part of the account's configuration, not an incidental
setting.

### Provisioning

On the staging DB (`qci_samar` on `qci-staging-vm` — see the backend infra map), create:

| Field | Value |
|---|---|
| Role | `enterprise_admin` (or `unit_admin`) on a demo applicant organisation. Both roles have `requires_organization = true`, and login refuses an account whose organisation is inactive — check the org's status, not just the user's. |
| `samar_id` | set **explicitly** — e.g. `SAMAR-REVIEW-APP`. Left empty, the `User::boot()` hook auto-generates `SAMAR-ddmmyy-{id}`, which changes if the account is ever recreated. Login upper-cases the identifier, so any case works at the prompt. |
| `is_two_factor_enabled` | `false` |
| `status` | active |
| Password | fixed; 7–16 characters (the login form's yup rule). Never rotate it without updating both store listings first. |
| Email | a mailbox QCI controls — password-reset and notification mail goes there |

The account must have **at least one application the reviewer can open**, far enough along
that the site-pictures and site-tour screens are reachable. An applicant account with an
empty home screen reads to a reviewer as a broken or content-less app, which is its own
rejection reason.

### The single-session caveat

Every role has `enforce_single_session = true`
(`database/migrations/2026_06_23_000001_enforce_single_session_for_all_roles.php`), and
displacement is same-class: one mobile session displaces the other mobile session. With one
shared account, an Apple reviewer and a Google reviewer testing in the same window will see
the **"Already Logged In"** modal and evict each other by tapping Continue.

This is survivable — the modal explains itself and Continue works — but it is worth
staggering the two submissions rather than filing them the same day. If a review is
rejected with something like "could not sign in" or "was logged out unexpectedly", this is
the first thing to check, and the fix is a second account for the other store.

## 3. Review-notes text

Paste into **App Store Connect → App Review Information → Notes**, and
**Play Console → App content → App access → All functionality requires access**:

> SAMAR Applicant is a private tool for enterprises applying to the Quality Council of
> India's SAMAR scheme (DRDO defence/aerospace vendor certification). It is used only by
> enterprises registered with QCI; there is no public sign-up and no in-app account
> creation, so the app also has no account-deletion flow — accounts are created and removed
> by QCI administrators.
>
> Sign in with:
> SAMAR ID: <SAMAR-REVIEW-APP>
> Password: <password>
>
> This account has a demo application on it. From the home screen, open the application to
> see its details and the site-picture and site-tour capture screens.
>
> The app requests camera and location permission when you first capture a site photo. Both
> are required for that feature only — site photographs are geo-tagged evidence of the
> applicant's premises — and the rest of the app works without granting them. Photographs
> are captured offline, stored on the device, and uploaded when connectivity returns.

Fill in the two placeholders from the provisioned account. **Do not commit the password to
this repo.**

## 4. Permissions

Camera and location are requested **in context**, at the first capture, by
`ensurePermission()` in `src/utils/permissions.js` — which re-prompts on a plain denial and
offers Open Settings when blocked.

That gate used to sit on the login screen and was removed on 20-Aug-2026: a reviewer who
declined either system prompt met a Login button that could never be enabled — the standard
shape of an Apple 5.1.1 rejection. The capture screens already enforced permissions
per-action, so the login-time block was redundant as well as risky. **Do not reinstate
it.**

## 5. Pre-submission checklist

- [ ] `git pull --rebase` on `development`; tree clean
- [ ] Version named by Navneet (never bumped autonomously) in `appsettings.json`
- [ ] `NODE_ENV=Production` prebuild run; `appsettings.Compiled.json` shows
      `"ENVIRONMENT": "Production"` and the staging `BASE_URL`
- [ ] App id is `org.qcin.samar.applicant` with **no** `.staging` suffix, in `gradle.properties` AND the iOS pbxproj
- [ ] Fresh keystore generated for this app; Play App Signing enabled; keystore backed up somewhere that is not this repo
- [ ] Firebase apps exist under the new id for this environment, and the config files in the repo match them
- [ ] Review account exists on staging, 2FA off, organisation active, password verified by
      an actual login from a device
- [ ] Review account has an open application
- [ ] **`SecurityGuard.kt` `PLAY_CERT_SHA256` filled** from Play Console -> Setup -> App
      signing -> "App signing key certificate" (SHA-256, converted to base64). `RELEASE_CERT_SHA256`
      and `DEBUG_CERT_SHA256` are already set from `android/app/release.jks` and the debug keystore. While
      `PLAY_CERT_SHA256` reads `UNSET` the signature check is SKIPPED entirely — a store build
      must not ship in that state, and it cannot be filled before the listing exists because
      Play generates that key
- [ ] Force-update check verified against the live listing once it exists (`useVersionCheck`
      only runs in Production and needs a published version to compare against)
- [ ] Review notes pasted into both consoles with the real credentials
- [ ] Privacy-policy URL reachable, and the data-safety / privacy-nutrition forms declare
      camera, location, and photos

## 6. Launch-day notes — read before the first submission

Things learned building this that are easy to get wrong months later, when whoever
ships it is not whoever wrote it.

### The TLS pins need re-verifying, not trusting

The pin set was correct when written, and a CA can restructure its hierarchy under
you with nothing expiring to warn anyone. On **20-Aug-2026** both hosts served:

```
leaf -> Let's Encrypt YE1/YE2 -> ISRG Root YE -> ISRG Root X2
```

We pin **three** roots — X1, X2 and **Root YE** — precisely because X2 sits at the
END of that chain. It is reachable today only because Root YE is not yet in device
trust stores; once it is, clients build a SHORTER path terminating at YE, X2 leaves
the verified chain, and an X1/X2-only pin set matches nothing. That failure cannot
be fixed server-side — it needs a store release and users installing it.

**Before submitting, re-check the live chain** and confirm at least one pinned hash
is still in it:

```bash
for h in samar-api.webority.dev samar-staging1.qci.org.in; do
  echo | openssl s_client -connect $h:443 -servername $h -showcerts 2>/dev/null     | openssl x509 -pubkey -noout | openssl pkey -pubin -outform DER     | openssl dgst -sha256 -binary | openssl base64
done
```

Compare against the pins in `network_security_config.xml` / `AppDelegate.swift`.
If none match, **do not ship** — fix the pins first.

### `PLAY_CERT_SHA256` is the last gate, and it cannot be pre-filled

Play App Signing re-signs distributed builds with **Google's** key, so an installed
app presents the PLAY hash and never our upload hash. Arming the signature check
with only `RELEASE_CERT_SHA256` makes every Play install fail its own check and kill
itself. That is why it ships `UNSET` and the check skips.

Fill it from **Play Console → Setup → App signing → "App signing key certificate"**
once the listing exists. It is a SHA-256 in hex; the constant wants base64:

```bash
echo "AB:CD:EF:..." | tr -d ':' | xxd -r -p | openssl base64
```

`RELEASE_CERT_SHA256` and `DEBUG_CERT_SHA256` are already filled. If you ever need
to recompute one and have no `keytool`: the value is `base64(SHA-256(DER cert))` —
for a PKCS12 keystore, `openssl pkcs12 -in ks.jks -nokeys -passin pass:X -legacy |
openssl x509 -outform DER | openssl dgst -sha256 -binary | openssl base64`. Sanity
check: the stock Android debug keystore always yields
`+sYXRdwJA3hvue3mKpYrOZ9zSPC7b4mbgzJmdZEDO5w=`.

### Do not "fix" the production-flavour gate

`SecurityGuard.isHardenedBuild()` is `!BuildConfig.DEBUG && FLAVOR == "production"`.
It looks like an oversight and is not. `assembleStagingRelease` /
`assembleDevelopmentRelease` and the Fastlane tester APKs are **release** builds, and
every Android emulator reports `test-keys`, usually runs SELinux permissive, and sets
`ro.debuggable=1` — so gating on `!BuildConfig.DEBUG` alone kills a tester's staging
APK on launch and again on its first network call. Production, the only flavour that
reaches a store, is fully fatal and unchanged.

Likewise `enforceThrottled()` on the network interceptor is deliberate: the full sweep
shells out twice, and these apps drain an offline outbox in bursts.
