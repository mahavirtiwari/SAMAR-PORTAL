# QCI SAMAR — Applicant App

Offline-first React Native app for QCI SAMAR applicants. Applicants view their applications and
capture site evidence — site pictures and site-tour photos. Work is written to local SQLite and
synced when connectivity returns.

Bare React Native 0.85 (not Expo). See [CLAUDE.md](CLAUDE.md) for architecture and conventions.

## Prerequisites

- Node.js and npm
- Android Studio / Xcode per the [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment)
- For iOS: CocoaPods (`bundle install`, then `bundle exec pod install` in `ios/`)

## Running

Builds are environment-targeted and go through `prebuild`, which compiles the config and patches
native files.

```bash
npm install

npm run android:development   # Android, development API
npm run ios:development       # iOS, development API
npm run android:stagingApk    # Staging release APK
npm start                     # Metro (react-native start)
```

`npm run android` is an alias for `android:staging`. The plain `android:debug`, `ios:dev`,
`ios:debug`, `ios:release` and `android:release` scripts skip `prebuild` and build whatever
config was last compiled — prefer the environment-targeted scripts above.

The root component is `App.js`.

## Configuration

`appsettings.json` (base) + `appsettings.<ENV>.json` are merged by `prebuild.js` into
`appsettings.Compiled.json` (generated, git-ignored) and imported by `appsettings.js` at the
repo root. `prebuild.js` also patches `android/gradle.properties` and the iOS `Info.plist`.

| Environment | API base URL |
|---|---|
| Development | `https://samar-api.webority.dev/api/v1/` |
| Staging | `https://samar-staging1.qci.org.in/api/v1/` |
| Production | **unset** — not provisioned (tracked in BUG-06301) |

## No TLS certificate pinning

Unlike the sibling assessor app, this app configures **no** certificate pinning — no
`CERTIFICATE_PINS` in any environment file and no pinning library wired in. Don't assume pinning
protects this client. Whether that's a deliberate scope decision or an oversight is not recorded
anywhere; see BUG-06301.

## Distribution

Manual — not published to Play Console or the App Store. Version lives in `appsettings.json`
(`VERSION_DISPLAY` / `VERSION_INTERNAL`) and is applied to native files by `prebuild.js`.

## Related repos

`../qci-samar-backend` (API — contract source of truth) · `../qci-samar-web` ·
`../qci-samar-assessor-mobile`. API contract changes land in the backend first.
