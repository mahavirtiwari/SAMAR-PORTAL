#!/bin/bash
# Builds signed SAMAR Android APKs (or Play Store AABs) on the server.
#
#   bash mobile-build/build-apk.sh <assessor|applicant|both> [Staging|Production|Development] [--aab]
#
# Examples:
#   bash mobile-build/build-apk.sh both                      # staging APKs for both apps
#   bash mobile-build/build-apk.sh assessor Production --aab # assessor Play Store bundle
#
# Before the first run: bash mobile-build/setup-build-server.sh, and put the release
# keystores in ~/samar-keys/ (assessor-release.jks, applicant-release.jks).
#
# Builds from a copy of the app under ~/apk-build so the git checkout used by the
# web deployment is never modified. Output: ~/apk-output.
#
# Environment overrides: SAMAR_SOURCE (git checkout), SAMAR_APK_WORK, SAMAR_APK_OUT,
# SAMAR_KEYS, SAMAR_ABIS (default armeabi-v7a,arm64-v8a), SAMAR_GRADLE_HEAP (default 2560m),
# SAMAR_SKIP_PULL=1 to build the checkout as it is.
#
# Production builds talk to the staging API (https://qcisamartest.qci.org.in) by design
# (backend docs D-007) until a production backend exists.
set -euo pipefail

APP=${1:-both}
ENVIRONMENT=${2:-Staging}
FORMAT=apk
[ "${3:-}" = "--aab" ] && FORMAT=aab

SRC=${SAMAR_SOURCE:-/var/www/qci-samar/source}
WORK=${SAMAR_APK_WORK:-$HOME/apk-build}
OUT=${SAMAR_APK_OUT:-$HOME/apk-output}
KEYS=${SAMAR_KEYS:-$HOME/samar-keys}
# Phones only; x86_64 is for emulators and adds a third native build.
ABIS=${SAMAR_ABIS:-armeabi-v7a,arm64-v8a}
HEAP=${SAMAR_GRADLE_HEAP:-2560m}
export ANDROID_HOME=${ANDROID_HOME:-/opt/android-sdk}
export ANDROID_SDK_ROOT=$ANDROID_HOME
export JAVA_HOME=${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

case "$APP" in assessor|applicant) APPS=("$APP") ;; both) APPS=(assessor applicant) ;;
    *) echo "First argument must be assessor, applicant or both." >&2; exit 2 ;; esac
case "$ENVIRONMENT" in Staging|Production|Development) ;;
    *) echo "Environment must be Staging, Production or Development." >&2; exit 2 ;; esac

[ -d "$ANDROID_HOME/cmdline-tools" ] || { echo "Android SDK not found in $ANDROID_HOME. Run mobile-build/setup-build-server.sh first." >&2; exit 1; }
[ -x "$JAVA_HOME/bin/java" ] || { echo "JDK 17 not found at $JAVA_HOME. Run mobile-build/setup-build-server.sh first." >&2; exit 1; }

if [ "${SAMAR_SKIP_PULL:-0}" != "1" ]; then
    echo "== git: updating $SRC to origin/main"
    git -C "$SRC" fetch --quiet origin
    git -C "$SRC" reset --hard --quiet origin/main
fi
COMMIT=$(git -C "$SRC" rev-parse --short HEAD)
echo "== building commit $COMMIT, $ENVIRONMENT, $FORMAT, ABIs $ABIS"

mkdir -p "$WORK" "$OUT"
started=$(date +%s)
results=()

for app in "${APPS[@]}"; do
    src_dir="$SRC/QCI-samar-$app-mobile-development/qci-samar-$app-mobile-development"
    work_dir="$WORK/$app"
    key="$KEYS/$app-release.jks"
    [ -d "$src_dir" ] || { echo "App folder not found: $src_dir" >&2; exit 1; }
    [ -f "$key" ] || { echo "Keystore missing: $key (copy the $app release.jks there)" >&2; exit 1; }

    echo
    echo "==== $app"
    # Keep node_modules and Gradle caches between builds; refresh everything else.
    rsync -a --delete \
        --exclude 'node_modules/' --exclude 'android/.gradle/' --exclude 'android/build/' \
        --exclude 'android/app/build/' --exclude 'android/app/.cxx/' --exclude '*.jks' \
        "$src_dir/" "$work_dir/"
    cp "$key" "$work_dir/android/app/release.jks"
    trap 'rm -f "$work_dir/android/app/release.jks"' EXIT

    cd "$work_dir"
    lock_sha=$(sha256sum package-lock.json | cut -d' ' -f1)
    if [ ! -f node_modules/.samar-lock-sha ] || [ "$(cat node_modules/.samar-lock-sha)" != "$lock_sha" ]; then
        echo "== $app: npm ci"
        npm ci --no-audit --no-fund
        echo "$lock_sha" > node_modules/.samar-lock-sha
    else
        echo "== $app: npm packages unchanged"
    fi

    echo "== $app: prebuild for $ENVIRONMENT"
    NODE_ENV=$ENVIRONMENT PLATFORM=android node prebuild.js

    if [ "$FORMAT" = "aab" ]; then task="bundle${ENVIRONMENT}Release"; else task="assemble${ENVIRONMENT}Release"; fi
    echo "== $app: gradlew $task (first build: 30-60 min on this server)"
    cd android
    chmod +x gradlew
    # Small heap and two workers to fit a ~4 GB server; low CPU priority so the web
    # app on the same machine stays responsive.
    gradle_args=(--no-daemon --max-workers=2
        -Dorg.gradle.jvmargs="-Xmx$HEAP -XX:MaxMetaspaceSize=768m -Dfile.encoding=UTF-8"
        -PreactNativeArchitectures="$ABIS")
    # Generate every library's codegen sources first. Gradle does not order the app's
    # CMake configure after them, so in one run it can configure while some are still
    # missing, skip them, and fail with "'rnclipboard.h' file not found".
    echo "== $app: gradlew generateCodegenArtifactsFromSchema"
    nice -n 15 ./gradlew generateCodegenArtifactsFromSchema "${gradle_args[@]}"
    # A CMake cache configured before those sources existed keeps skipping them.
    if [ -d app/.cxx ] && [ -n "$(find ../node_modules -path '*/build/generated/source/codegen/jni' -type d -newer app/.cxx -print -quit)" ]; then
        echo "== $app: codegen sources are newer than the CMake cache; clearing app/.cxx"
        rm -rf app/.cxx
    fi
    nice -n 15 ./gradlew "$task" "${gradle_args[@]}"
    cd ..

    flavor=$(echo "$ENVIRONMENT" | tr '[:upper:]' '[:lower:]')
    if [ "$FORMAT" = "aab" ]; then
        artifact=$(ls -t android/app/build/outputs/bundle/"${flavor}"Release/*.aab | head -1)
    else
        artifact=$(ls -t android/app/build/outputs/apk/"$flavor"/release/*.apk | head -1)
    fi
    version=$(grep '^VERSION_DISPLAY=' android/gradle.properties | cut -d= -f2)
    code=$(grep '^VERSION_INTERNAL=' android/gradle.properties | cut -d= -f2)
    target="$OUT/SAMAR-$app-$flavor-v$version($code)-$COMMIT-$(date +%Y%m%d-%H%M).$FORMAT"
    cp "$artifact" "$target"
    rm -f android/app/release.jks
    trap - EXIT

    echo "Output : $target"
    echo "Size   : $(du -h "$target" | cut -f1)"
    echo "SHA-256: $(sha256sum "$target" | cut -d' ' -f1)"
    results+=("$target")
done

echo
echo "Done in $(( ($(date +%s) - started) / 60 )) min:"
printf '  %s\n' "${results[@]}"
