# Refreshing the native tree after a dependency bump

Read this the moment a pull changes `react-native` (or any package with a native
pod) in `package.json`. Skipping it produces two failures that look unrelated and
neither names the real cause.

## Why it is needed

`ios/Pods` and `ios/Podfile.lock` are build state, not source. A React Native bump
changes the podspecs in `node_modules`, but nothing forces the already-installed
native tree to catch up:

- If `Podfile.lock` still records the OLD version, `pod install` refuses to resolve
  and tells you to run `pod update <pod>` — misleading, because the lockfile is
  stale rather than the constraint being wrong.
- If `Podfile.lock` already reads the NEW version but `Pods/` was built against the
  old one, `pod install` reports success and the app builds green. It then dies at
  launch on a dyld symbol mismatch, typically between `React.framework` and
  `hermesvm.framework`:

  ```
  Symbol not found: __ZN8facebook3jsi5Array18createWithElementsERNS0_7RuntimeESt16initializer_listINS0_5ValueEE
    Referenced from: React.framework/React
    Expected in:     hermesvm.framework/hermesvm
  ```

  That is the dangerous one: every gate is green and the crash arrives only on a
  real device or simulator.

## The refresh

Run from the repo root. Deleting the Hermes cache matters — a cached tarball is
copied back in on a cache hit without any version check.

```bash
npm install
cd ios && rm -rf ./Pods ./build ./Podfile.lock
cd "$HOME/Library/Caches" && rm -rf ./ReactNative
cd - >/dev/null && pod install
```

Then rebuild. A clean install prints `Cache miss: downloading hermes-ios-…` followed
by a checksum verification; a `Cache hit` line on the first run after a bump means
the purge did not take.

## Verifying it worked

```bash
grep -m1 '^  - React-Core (' ios/Podfile.lock   # must match package.json
```

Then build for the simulator and launch. If the app terminates immediately, read the
real reason rather than guessing — the crash report names the missing symbol:

```bash
ls -t ~/Library/Logs/DiagnosticReports/qciapplicantapp-*.ips | head -1
```

## Keeping it from recurring

`ios/Podfile.lock` is committed on purpose (the `.gitignore` carries an explicit
`!ios/Podfile.lock` negation, because the blanket `*.lock` rules above it would
otherwise swallow the file). Commit the regenerated lockfile in the same commit as
the dependency bump. That way the bump and its native consequence travel together,
and the next person's `pod install` fails loudly instead of at app launch.
