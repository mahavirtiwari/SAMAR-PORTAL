---
id: D-007
title: The first mobile store release is a pilot running against staging
status: Accepted (Navneet, 20-Aug-2026)
date: 2026-08-20
---

# D-007: The first mobile store release is a pilot running against staging

## Context

The applicant and assessor apps are being submitted to the Play Store and the App Store.

There is no production environment. `.webority/infra.json` records
`environments.production = null` and every deployable's `production` entry as `null`; only
`samar-api.webority.dev` (dev) and `qcisamartest.qci.org.in` (QCI-hosted staging) exist.
Both apps carried an **empty** `BASE_URL` in `appsettings.Production.json`, so a build made
with `NODE_ENV=Production` compiled fine and then failed on its first network call. Store
submission was impossible on that config.

QCI has not committed to a production host or a date.

## Decision

**This store release is a pilot. The apps go to both stores pointing at staging, and the
system stays a testing system.**

That is the intent, and it is what makes this a small decision rather than a large one: we
are not declaring the SAMAR platform live. When a production backend is provisioned, the
apps are repointed and **released again** — that second release is the real production
launch. Until then, the store listings are a distribution channel for testing, and staging
remains a testing environment with the posture a testing environment has.

Concretely:

- `appsettings.Production.json` in `qci-samar-applicant-mobile` and
  `qci-samar-assessor-mobile` carries the **staging** `BASE_URL`. The `Production` *app
  config* now means "the config a store build ships with", not "points at a production
  backend".
- `APP_ID_SUFFIX` stays `""` for Production, so the store binaries are
  `org.qcin.samar.assessor` and `org.qcin.samar.applicant` — the real, un-suffixed ids. This
  is the one thing that must not be confused with the `.staging` internal builds. (Both apps
  were renamed onto that scheme on 20-Aug-2026 and relaunch as fresh store listings from
  1.0.0 — see D-009.)
- The assessor app's TLS pinning already covers `qcisamartest.qci.org.in` in both
  `android/app/src/main/res/xml/network_security_config.xml` and
  `ios/assessor/AppDelegate.swift`, so the store build is pinned exactly as the staging
  build is. **No native pinning change was needed, and none may be made without a
  coordinated release.**
- The pin set targets the ISRG roots (not the leaf), with `expiration="2027-06-01"`. A
  Let's Encrypt renewal on the staging host does not break released builds; a move to a
  different CA does.
- The applicant app pins the same two ISRG roots (added 20-Aug-2026 when the full
  security-grade tier was applied to it; D-008, which had recorded the opposite, is
  superseded).

## Consequences

What this buys: the apps can be distributed and exercised through the real store channel
now, on real devices, by real assessors and applicants, without waiting on infrastructure
QCI has not scheduled.

What it costs — none of it a blocker under the pilot framing, but all of it worth knowing:

- Staging keeps its testing posture: **no backups** on `qci-staging-vm` (accepted, Navneet,
  18-Jul-2026), and `deploy-staging.sh fresh` still exists and still wipes the database.
  That is consistent with a pilot; it stops being consistent the moment anyone starts
  treating this data as production data. **The trigger to revisit backups is the production
  provisioning, not user growth** — if real dependence on this data arrives before
  production does, this decision needs reopening.
- Internal staging testing and pilot store users share the `qci_samar` database. Someone
  running a staging test is touching pilot users' data, and vice versa.
- `LOGGING_ENABLED` is `false` in the Production config, so client-side logs will not be
  available from pilot users' devices — the population most likely to hit problems. Worth
  reconsidering if pilot feedback proves hard to diagnose.

## Reversal — the real production launch

When a production backend is provisioned:

1. Point `appsettings.Production.json` `BASE_URL` at it in both apps.
2. Add the production `domain-config` block to the assessor's
   `network_security_config.xml` and the matching `kTSKPinnedDomains` entry in
   `AppDelegate.swift` — both files already carry a commented placeholder for it. Pin the
   **roots** of whatever CA issues the production cert, never the leaf. Revisit D-008 for
   the applicant app at the same time.
3. Fill `environments.production` and each deployable's `production` entry in
   `qci-samar-backend/.webority/infra.json`, and drop the "no production exists" guard.
4. Decide what happens to pilot data on staging — migrated to production, or discarded.
   The pilot framing means discarding is a legitimate answer, but it must be an answered
   question, not a discovered one.
5. Ship an app update to both stores. Until users install it, released builds keep talking
   to staging — plan the cutover so staging keeps answering during the rollout.

Step 5 is why this is not a free flip: repointing needs a store release and a user-upgrade
window.

## Store review access

Both stores require working sign-in credentials for review. Neither app has in-app account
creation, so accounts are provisioned by QCI. See each app's
`docs/40-release/store-release.md` for the review-account provisioning procedure and the
review-notes text.

The one backend fact that makes this easy: `users.is_two_factor_enabled` defaults to
`false`, and `AuthService::login()` (`app/Services/Auth/AuthService.php:182`) short-circuits
the whole OTP flow for such a user — direct token issue, no email round-trip. A review
account therefore needs no code change and no OTP bypass to be reviewable.
