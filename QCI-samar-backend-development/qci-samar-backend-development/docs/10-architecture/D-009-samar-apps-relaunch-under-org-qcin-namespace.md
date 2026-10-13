---
id: D-009
title: Both SAMAR apps relaunch as fresh store listings under the org.qcin namespace
status: Accepted (Navneet, 20-Aug-2026)
date: 2026-08-20
---

# D-009: Both SAMAR apps relaunch as fresh store listings under the `org.qcin` namespace

## Context

Preparing the first store submission of the rewritten apps surfaced that the app identities
were incoherent, and in one case actively broken.

**What was live before this decision:**

| Store | Listing | Id |
|---|---|---|
| Play | "Samar Assessor App" | `com.qciapp` |
| App Store | "Samar Assessor App", v1.1.9, released 2023-11-06, seller "Quality Council of India" ([id1672210324](https://apps.apple.com/in/app/samar-assessor-app/id1672210324)) | `com.samar.qci.drdo` |

**What the repos built:**

| Repo | Android | iOS |
|---|---|---|
| `qci-samar-assessor-mobile-old` (retired) | `com.qciapp` | `com.samar.qci.drdo` |
| `qci-samar-assessor-mobile` (current) | `com.qciapp` | **`com.qciapp`** |
| `qci-samar-applicant-mobile` | `com.qciapplicantapp` | `com.qciapplicantapp` |

**The defect.** The rewrite unified both platforms onto a single `APP_ID` in
`appsettings.json`, from which `prebuild.js` derives `CFBundleIdentifier` and
`PRODUCT_BUNDLE_IDENTIFIER`. Android survived by coincidence — it was already `com.qciapp`.
**iOS did not**: the live bundle id `com.samar.qci.drdo` was silently dropped, and the string
appears nowhere in the current repo. Submitting that build would have created a **second,
unrelated App Store listing**, stranding every existing iOS user on v1.1.9 with no upgrade
path — and the Firebase iOS apps were registered against the wrong id too, so Crashlytics
would have reported nothing.

It was found by looking the app up on the App Store by *name* rather than by the repo's own
bundle id. Searching by the repo's id returned `resultCount: 0`, which reads as "never
published" when it actually meant "this id is wrong". **A zero-result identity lookup is
evidence of a mismatch, not of absence** — worth remembering the next time an id is verified.

Separately, the ids themselves were never a scheme: `com.qciapp` means nothing outside this
project, `com.qciapplicantapp` is not its sibling, and neither derives from QCI's actual
domain, `qcin.org`.

## Decision

**Both apps relaunch as fresh store listings, from version 1.0.0, under a reverse-DNS
namespace derived from `qcin.org`:**

| App | Id (both platforms) | Store display name |
|---|---|---|
| Assessor | `org.qcin.samar.assessor` | SAMAR Assessor |
| Applicant | `org.qcin.samar.applicant` | SAMAR Applicant |

Environment suffixes are unchanged: `""` (store), `.staging`, `.development`.

Why this shape:

- **`org.qcin`** is the reverse of QCI's own domain — the conventional owner-identifying root.
- **`.samar`** groups the scheme, so a future SAMAR app is `org.qcin.samar.<role>` and a
  future QCI scheme is `org.qcin.<scheme>.<role>`. QCI is a certification body; more schemes
  is the likely direction.
- **Identical on iOS and Android**, so the config chain keeps ONE `APP_ID` and `prebuild.js`
  needs no per-platform split. The alternative — teaching the config chain about per-platform
  ids purely to preserve `com.samar.qci.drdo` — was rejected along with the continuity it
  was there to protect.

**Both stores publish under QCI's own developer accounts**, matching the current
"Quality Council of India" publisher name. Webority's accounts were considered and rejected:
a DRDO-linked government scheme should not list under a vendor's name.

**The old listings are unpublished once the new ones are live.** Their users get no
automatic upgrade path — accepted, given the iOS build has been untouched since November 2023.

## Consequences

- **This is a one-way door.** A published Play package name can never be reused, on any
  account, ever. `org.qcin.samar.assessor` and `org.qcin.samar.applicant` are permanent.
- **Both submissions are first submissions**, not updates — full review scrutiny on both
  stores, for both apps. The review-account and review-notes work in each repo's
  `docs/40-release/store-release.md` applies to all four submissions.
- **The keystore question dissolves.** The retired and current assessor repos carry different
  keystore files (`my-safe-key-keystore.keystore` vs `.jks`) and it was never established
  whether they hold the same key. A fresh Play listing needs a fresh upload key, so the
  question stops mattering. **Generate new keystores per app and enable Play App Signing**,
  so a lost upload key is recoverable rather than fatal.
- **Every Firebase app must be re-registered.** The six existing `qci-samar` apps are all
  `com.qciapp`-based and become dead on this rename.
- **Version resets to 1.0.0 / internal 1** for both apps (the assessor was 3.0.0 / 10). Store
  version history is per-listing, so a fresh listing starting at 1.0.0 is correct, not a
  regression.
- Existing installs of either old app keep working against staging until their listing is
  pulled — they are the same client code talking to the same API.

## What is NOT decided here

- The migration message for existing users of the old listings, if any is wanted beyond
  unpublishing.
- Whether the old apps get a final "this app has moved" release before being pulled. That
  needs access to the old app records and two extra submissions; deferred.
