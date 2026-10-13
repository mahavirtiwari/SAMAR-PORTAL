#!/bin/bash

# Clean install script for React Native project
echo "🧹 Cleaning React Native project..."

# Remove node_modules and lock files
echo "📁 Removing node_modules..."
rm -rf node_modules

echo "🔒 Removing package-lock.json..."
rm -f package-lock.json

echo "🔒 Removing yarn.lock..."
rm -f yarn.lock

# Clean npm cache
echo "🗑️ Cleaning npm cache..."
npm cache clean --force

# Reinstall dependencies
echo "📦 Installing dependencies..."
npm install

# Clean Android build
echo "🤖 Cleaning Android build..."
cd android
./gradlew clean
cd ..

# Clean iOS build (if on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 Cleaning iOS build..."
    cd ios
    rm -rf build
    rm -rf Pods
    rm -f Podfile.lock
    cd ..
fi

echo "✅ Clean install completed!"
echo "💡 You can now run your React Native app"