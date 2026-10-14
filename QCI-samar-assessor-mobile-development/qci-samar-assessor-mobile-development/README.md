# QCI SAMAR — Assessor App

Offline-first React Native app for QCI SAMAR assessors. Assessors punch in/out with selfie and
geolocation, record responses to assessment parameters, capture site pictures and site-tour
evidence, and hold opening/closing meetings. Work is written to local SQLite and synced when
connectivity returns.

Bare React Native 0.85 (not Expo). See [CLAUDE.md](CLAUDE.md) for architecture and conventions.

## Prerequisites

- Node.js and npm
- Android Studio / Xcode per the [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment)
- For iOS: CocoaPods (`bundle install`, then `bundle exec pod install` in `ios/`)

## Running

There is **no `start`, `android`, or `ios` script** in this repo — builds are environment-targeted
and must go through `prebuild`, which compiles the config and patches native files.

```bash
npm install

npm run android:development   # Android, development API
npm run ios:development       # iOS, development API
npm run android:stagingApk    # Staging release APK

npx react-native start        # Metro, if you need it running separately
```

Running a build without `prebuild` ships whatever config was last compiled — always use the
environment-targeted scripts above rather than bare `react-native run-*`.

The root component is `App.js`.

## Configuration

`appsettings.json` (base) + `appsettings.<ENV>.json` are merged by `prebuild.js` into
`appsettings.Compiled.json` (generated, git-ignored) and imported by `appsettings.js` at the
repo root. `prebuild.js` also patches `android/gradle.properties` and the iOS `Info.plist`.

| Environment | API host |
|---|---|
| Development | `samar-api.webority.dev` |
| Staging | `qcisamartest.qci.org.in` |
| Production | **not provisioned** — placeholders only |

## TLS certificate pinning — read before touching any certificate or domain

Pinning is enforced natively: `android/app/src/main/res/xml/network_security_config.xml` on
Android, TrustKit in `ios/assessor/AppDelegate.swift` with `kTSKEnforcePinning: true`.

Pins target the **ISRG root** certificates rather than leaves, so routine Let's Encrypt leaf
renewals (~60 days) don't break installed builds. **Rotating the API certificate to a different
root, or changing the API domain, bricks every installed pinned build** — it must ship in
lockstep with an app release. There is no server-side hotfix.

## Related repos

`../qci-samar-backend` (API — contract source of truth) · `../qci-samar-web` ·
`../qci-samar-applicant-mobile`. API contract changes land in the backend first.
