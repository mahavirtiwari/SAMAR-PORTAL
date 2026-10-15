#!/bin/bash
# One-time setup of an Ubuntu server for building the SAMAR Android apps.
#
#   bash mobile-build/setup-build-server.sh
#
# Installs JDK 17, the Android SDK command-line tools and the SDK packages the
# apps compile against, adds swap (React Native's native build needs far more
# memory than a 4 GB server has), and creates the key and output folders.
# Running it again is safe: finished steps are skipped.
#
# Note: it accepts the Android SDK licence terms on your behalf (sdkmanager --licenses).
set -euo pipefail

SDK=${ANDROID_HOME:-/opt/android-sdk}
SWAP_GB=${SAMAR_SWAP_GB:-6}
# Android command-line tools (Linux). Newer builds work too; see
# https://developer.android.com/studio#command-line-tools-only
CMDLINE_TOOLS_ZIP=commandlinetools-linux-11076708_latest.zip

echo "== packages"
sudo apt-get update -qq
sudo apt-get install -y -qq openjdk-17-jdk-headless unzip rsync curl >/dev/null
java -version 2>&1 | head -1

if ! command -v node >/dev/null; then
    echo "== Node.js 20"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null
    sudo apt-get install -y -qq nodejs >/dev/null
fi
echo "node $(node -v)"

echo "== swap"
if swapon --show=NAME --noheadings | grep -q '^/swapfile$'; then
    echo "swap already on: $(swapon --show=SIZE --noheadings | head -1)"
else
    sudo fallocate -l "${SWAP_GB}G" /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile >/dev/null
    sudo swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
    echo "added ${SWAP_GB} GB swap"
fi

echo "== Android SDK in $SDK"
sudo mkdir -p "$SDK"
sudo chown -R "$USER":"$USER" "$SDK"
if [ ! -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
    tmp=$(mktemp -d)
    curl -fsSL -o "$tmp/tools.zip" "https://dl.google.com/android/repository/$CMDLINE_TOOLS_ZIP"
    unzip -q "$tmp/tools.zip" -d "$tmp"
    mkdir -p "$SDK/cmdline-tools"
    rm -rf "$SDK/cmdline-tools/latest"
    mv "$tmp/cmdline-tools" "$SDK/cmdline-tools/latest"
    rm -rf "$tmp"
fi
export ANDROID_HOME="$SDK" ANDROID_SDK_ROOT="$SDK"
export PATH="$SDK/cmdline-tools/latest/bin:$SDK/platform-tools:$PATH"

yes | sdkmanager --licenses >/dev/null || true
# Versions from android/build.gradle (compileSdk 37, build-tools 37.0.0, NDK 27.1, CMake 3.22.1).
sdkmanager --install "platform-tools" "build-tools;37.0.0" "ndk;27.1.12297006" "cmake;3.22.1" >/dev/null
# Platform package names changed in newer SDKs; if this one is not found, Gradle
# downloads the right platform itself on the first build (licences are accepted).
sdkmanager --install "platforms;android-37.0" >/dev/null 2>&1 \
    || sdkmanager --install "platforms;android-37" >/dev/null 2>&1 \
    || echo "platform 37 will be downloaded by Gradle on the first build"

echo "== environment"
if ! grep -q 'ANDROID_HOME=' "$HOME/.bashrc"; then
    {
        echo "export ANDROID_HOME=$SDK"
        echo "export ANDROID_SDK_ROOT=$SDK"
        echo "export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64"
        echo 'export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"'
    } >> "$HOME/.bashrc"
fi

mkdir -p "$HOME/samar-keys" "$HOME/apk-output"
chmod 700 "$HOME/samar-keys"

echo
echo "Done. Next:"
echo "  1. Copy the two release keystores to ~/samar-keys/ as assessor-release.jks and applicant-release.jks"
echo "  2. bash mobile-build/build-apk.sh both Staging"
df -h / | tail -1
