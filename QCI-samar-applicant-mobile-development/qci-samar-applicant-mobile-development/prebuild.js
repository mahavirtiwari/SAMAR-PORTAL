/**
 * ================================================================
 *                          Prebuild Script
 * ================================================================
 *
 * This script automates the configuration setup for your React Native
 * project based on the specified environment (Staging or Production).
 * It performs the following tasks:
 *
 * 1. **Determine the Environment:**
 *    - Reads the `NODE_ENV` environment variable to identify the current
 *      environment (`Staging` or `Production`).
 *    - Defaults to `Staging` if `NODE_ENV` is not set.
 *    - With `--same-env`, recompiles the environment recorded in the existing
 *      `appsettings.Compiled.json` (used by the env-less build scripts to
 *      refresh the build stamp without switching environment).
 *
 * 2. **Load Configuration Files:**
 *    - **Base Configuration:** `appsettings.json` contains default settings.
 *    - **Environment-Specific Configuration:** `appsettings.{ENV}.json`
 *      (e.g., `appsettings.Staging.json`, `appsettings.Production.json`)
 *      contains overrides specific to the environment.
 *
 * 3. **Merge Configurations:**
 *    - Combines base and environment-specific configurations, with the
 *      environment-specific settings overriding the base.
 *
 * 4. **Generate Compiled Configuration:**
 *    - Writes the merged configuration to `appsettings.Compiled.json`,
 *      stamped with the source `COMMIT` and `BUILD_TIME` (build identity).
 *
 * 5. **Apply Configurations to Native and JavaScript Layers:**
 *    - **`gradle.properties` (Android):** Updates with necessary Android
 *      configurations.
 *    - **`Info.plist` (iOS):** Updates with necessary iOS configurations
 *      based on the environment.
 *    - **Fastlane Configuration:** Generates .env files for Fastlane to use
 *
 * 6. **Logging and Error Handling:**
 *    - Provides detailed logs at each step for easy debugging and tracing.
 *    - Exits the build process if critical configuration files are missing
 *      or malformed.
 *
 * ---------------------------------------------------------------
 *                      Setup Instructions
 * ---------------------------------------------------------------
 *
 * **Prerequisites:**
 * - Ensure you have Node.js installed on your machine.
 * - Ensure you have access to modify the following files:
 *   - `package.json`
 *   - `android/gradle.properties`
 *   - `ios/[ProjectFolder]/Info.plist`
 *
 * **Steps to Set Up the Environment:**
 *
 * 1. **Create Configuration Files:**
 *    - **Base Configuration (`appsettings.json`):**
 *      - Located at the root of your project.
 *      - Contains default settings applicable across all environments.
 *
 *    - **Environment-Specific Configurations:**
 *      - **Staging (`appsettings.Staging.json`):**
 *        - Located at the root of your project.
 *        - Contains settings specific to the Staging environment.
 *      - **Production (`appsettings.Production.json`):**
 *        - Located at the root of your project.
 *        - Contains settings specific to the Production environment.
 *
 * 2. **Configure Build Scripts in `package.json`:**
 *    - Define scripts to build the app for different environments and platforms.
 *
 * 3. **Run the Prebuild Script:**
 *    - Before building the app, the `prebuild.js` script should be executed to generate and apply the necessary configurations.
 *
 * 4. **Access Configurations in JavaScript:**
 *    - Import the compiled configuration in your JavaScript code to access environment-specific settings.
 *
 * 5. **Ensure Native Configurations are Updated:**
 *    - **Android (`gradle.properties`):** The script updates this file with necessary configurations.
 *    - **iOS (`Info.plist`):** The script replaces placeholders with actual values based on the environment.
 *
 * ---
 *
 * **Note:** Ensure that all configuration files (`appsettings.json`, `appsettings.Staging.json`, `appsettings.Production.json`) are correctly formatted and located at the root of your project. The `prebuild.js` script relies on these files to generate the final configurations.
 *
 * ================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths to configuration files
const baseConfigPath = path.resolve(__dirname, 'appsettings.json');
const compiledConfigPath = path.resolve(__dirname, 'appsettings.Compiled.json');

// Determine the environment: Staging or Production
// --same-env recompiles for whatever environment was last compiled (falling
// back to the Staging default), refreshing the commit stamp WITHOUT switching
// env. Used by the build scripts that don't target a specific environment
// (android:debug/release, ios:dev/debug/release) so they never ship stale.
let ENV = process.env.NODE_ENV || 'Staging'; // Default to 'Staging' if not set
if (process.argv.includes('--same-env')) {
  try {
    ENV = JSON.parse(fs.readFileSync(compiledConfigPath, 'utf8')).ENVIRONMENT || ENV;
  } catch {
    // No compiled config yet: keep the default.
  }
}
const PLATFORM = process.env.PLATFORM || 'android'; // Default to 'android' if not set

const envConfigPath = path.resolve(__dirname, `appsettings.${ENV}.json`);

/**
 * Load and parse a JSON configuration file.
 */
function loadJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: Configuration file not found: ${filePath}`);
    process.exit(1);
  }
  const data = fs.readFileSync(filePath, 'utf8');
  try {
    const parsedData = JSON.parse(data);

    return parsedData;
  } catch (error) {
    console.error(`❌ Error parsing JSON file: ${filePath}\n${error}`);
    process.exit(1);
  }
}

/**
 * Merge two configuration objects.
 */
function mergeConfigs(base, env) {
  return { ...base, ...env };
}

/**
 * Write a JSON object to a file.
 */
function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`❌ Error writing to file: ${filePath}\n${error}`);
    process.exit(1);
  }
}

/**
 * Update `gradle.properties` with configuration.
 */
function updateGradleProperties(config) {
  const gradlePropsPath = path.resolve(__dirname, 'android', 'gradle.properties');

  let existingGradleProps = {};
  if (fs.existsSync(gradlePropsPath)) {
    const gradleData = fs.readFileSync(gradlePropsPath, 'utf8');
    gradleData.split('\n').forEach(line => {
      if (line.includes('=')) {
        const [key, ...rest] = line.split('=');
        existingGradleProps[key.trim()] = rest.join('=').trim();
      }
    });
  }

  const gradlePropsToAdd = {
    APP_NAME: config.APP_NAME,
    APP_ID: config.APP_ID,
    APP_ID_SUFFIX: config.APP_ID_SUFFIX,
    VERSION_DISPLAY: config.VERSION_DISPLAY,
    VERSION_INTERNAL: config.VERSION_INTERNAL,
    BASE_URL: config.BASE_URL,
  };

  const updatedGradleProps = { ...existingGradleProps, ...gradlePropsToAdd };
  const gradleContent = Object.entries(updatedGradleProps)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(gradlePropsPath, gradleContent, 'utf8');
}

/**
 * Update `Info.plist` file with configuration.
 */
function updateInfoPlist(config) {
  const infoPlistPath = path.resolve(__dirname, 'ios', 'qciapplicantapp', 'Info.plist');

  if (!fs.existsSync(infoPlistPath)) {
    console.error(`❌ Error: Info.plist file not found: ${infoPlistPath}`);
    process.exit(1);
  }

  let plistData = fs.readFileSync(infoPlistPath, 'utf8');

  // CFBundleIdentifier is deliberately NOT written here. Info.plist carries
  // $(PRODUCT_BUNDLE_IDENTIFIER), which Xcode expands from the pbxproj value
  // updatePbxproj() sets — one source of truth. Stamping a literal here fought
  // that: the id came from two places and whichever ran last won, which is how
  // an app can silently ship under the wrong bundle id.
  const plistVars = {
    CFBundleDisplayName: config.APP_NAME,
    CFBundleShortVersionString: config.VERSION_DISPLAY,
    CFBundleVersion: config.VERSION_INTERNAL,
  };

  Object.entries(plistVars).forEach(([key, value]) => {
    const regex = new RegExp(`(<key>${key}</key>\\s*<string>)(.*?)(</string>)`, 'm');
    plistData = plistData.replace(regex, `$1${value}$3`);
  });

  fs.writeFileSync(infoPlistPath, plistData, 'utf8');
}

/**
 * Update `.pbxproj` file with environment-specific App Icon.
 */
function updatePbxproj(config) {
  const pbxprojPath = path.resolve(
    __dirname,
    'ios',
    'qciapplicantapp.xcodeproj',
    'project.pbxproj',
  );

  if (!fs.existsSync(pbxprojPath)) {
    console.error(`❌ Error: .pbxproj file not found: ${pbxprojPath}`);
    process.exit(1);
  }

  let pbxprojData = fs.readFileSync(pbxprojPath, 'utf8');

  // Update App Icon name based on environment
  const appIconName =
    ENV === 'Production'
      ? 'AppIcon-Production'
      : ENV === 'Staging'
        ? 'AppIcon-Staging'
        : 'AppIcon-Development';
  console.log(`📱 Setting iOS App Icon to: ${appIconName}`);
  const appIconRegex = /ASSETCATALOG_COMPILER_APPICON_NAME = .*?;/g;
  pbxprojData = pbxprojData.replace(
    appIconRegex,
    `ASSETCATALOG_COMPILER_APPICON_NAME = ${appIconName};`,
  );

  // Update PRODUCT_BUNDLE_IDENTIFIER with the bundle ID
  const bundleIdRegex = /PRODUCT_BUNDLE_IDENTIFIER = .*?;/g;
  pbxprojData = pbxprojData.replace(
    bundleIdRegex,
    `PRODUCT_BUNDLE_IDENTIFIER = "${config.APP_ID + config.APP_ID_SUFFIX}";`,
  );

  fs.writeFileSync(pbxprojPath, pbxprojData, 'utf8');
}

/**
 * Generate Fastlane .env file for configuration
 */
function updateFastlaneConfig(config) {
  let fastlaneDirPath;

  if (PLATFORM === 'android') {
    fastlaneDirPath = path.resolve(__dirname, 'android', 'fastlane');
  } else if (PLATFORM === 'ios') {
    fastlaneDirPath = path.resolve(__dirname, 'ios', 'fastlane');
  } else {
    console.log(`⚠️ Skipping Fastlane config generation for unknown platform: ${PLATFORM}`);
    return;
  }

  // Check if fastlane directory exists
  if (!fs.existsSync(fastlaneDirPath)) {
    console.log(`⚠️ Fastlane directory not found: ${fastlaneDirPath}. Skipping.`);
    return;
  }

  // Create the .env file path - use .env.environment_name format
  const envFileName = `.env.${ENV.toLowerCase()}`;
  const envFilePath = path.join(fastlaneDirPath, envFileName);

  // Generate .env file content
  const envContent = `
# Generated by prebuild.js - DO NOT EDIT MANUALLY
# Environment: ${ENV}
# Platform: ${PLATFORM}
# Generated at: ${new Date().toISOString()}

APP_NAME="${config.APP_NAME}"
APP_IDENTIFIER="${config.APP_ID}${config.APP_ID_SUFFIX}"
VERSION_NAME="${config.VERSION_DISPLAY}"
VERSION_CODE="${config.VERSION_INTERNAL}"
APP_ENVIRONMENT="${ENV}"
  `.trim();

  // Write to the file
  try {
    fs.writeFileSync(envFilePath, envContent + '\n', 'utf8');
    console.log(`✅ Generated Fastlane environment file: ${envFilePath}`);

    // Also create a generic .env file that links to the specific environment
    const genericEnvPath = path.join(fastlaneDirPath, '.env');
    fs.writeFileSync(
      genericEnvPath,
      `# Auto-generated by prebuild.js\n# Points to the current environment: ${ENV}\n\nIMPORT_FROM_ENV=${ENV.toLowerCase()}\n`,
      'utf8',
    );
    console.log(`✅ Updated Fastlane generic .env file: ${genericEnvPath}`);
  } catch (error) {
    console.error(`❌ Error writing Fastlane .env file: ${envFilePath}\n${error}`);
  }
}

/**
 * Copy the correct GoogleService-Info.plist for the target environment.
 * Each environment is a distinct Firebase app (distinct bundle id), so the
 * wrong plist silently reports crashes against the wrong app rather than
 * failing — hence the loud warning when the source is missing.
 */
function copyGoogleServicePlist() {
  const plistDir = path.resolve(__dirname, 'ios', 'qciapplicantapp', 'firebase');
  const destPath = path.resolve(__dirname, 'ios', 'qciapplicantapp', 'GoogleService-Info.plist');
  const destPathRoot = path.resolve(__dirname, 'ios', 'GoogleService-Info.plist');

  let srcFile;
  if (ENV === 'Production') {
    srcFile = 'GoogleService-Info-Production.plist';
  } else if (ENV === 'Development') {
    srcFile = 'GoogleService-Info-Development.plist';
  } else {
    srcFile = 'GoogleService-Info-Staging.plist';
  }
  const srcPath = path.resolve(plistDir, srcFile);

  if (!fs.existsSync(srcPath)) {
    console.warn(`⚠️ Firebase source plist not found: ${srcPath}`);
    return;
  }

  try {
    fs.copyFileSync(srcPath, destPath);
    fs.copyFileSync(srcPath, destPathRoot);
    console.log(`✅ Copied ${srcFile} → ios/GoogleService-Info.plist`);
  } catch (error) {
    console.error(`❌ Error copying GoogleService-Info.plist: ${error}`);
  }
}

/**
 * Short git SHA of HEAD, with a "-dirty" suffix when uncommitted changes would
 * ship in the build. Null when git is unavailable. Surfaced in the Profile
 * screen and the X-Client-Build request header so any installed build is
 * traceable to a commit even when VERSION_DISPLAY has not changed between
 * test builds.
 */
function gitCommit() {
  const git = (args) =>
    execSync(`git ${args}`, { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  // Prebuild itself rewrites these tracked native files on every env-targeted
  // build, so they must not count as dirt: otherwise every build after the
  // first env switch would stamp "-dirty" on genuinely clean source.
  const excludes = [
    'android/gradle.properties',
    'ios/qciapplicantapp/Info.plist',
    'ios/qciapplicantapp.xcodeproj/project.pbxproj',
    'ios/qciapplicantapp/GoogleService-Info.plist',
    'ios/GoogleService-Info.plist'
  ]
    .map((p) => `":(exclude)${p}"`)
    .join(' ');
  try {
    const sha = git('rev-parse --short HEAD');
    return git(`status --porcelain -- . ${excludes}`) ? `${sha}-dirty` : sha;
  } catch {
    return null;
  }
}

/**
 * Main execution function.
 */
(function main() {
  const baseConfig = loadJSON(baseConfigPath);
  const envConfig = loadJSON(envConfigPath);
  const finalConfig = mergeConfigs(baseConfig, envConfig);
  finalConfig.COMMIT = gitCommit();
  finalConfig.BUILD_TIME = new Date().toISOString();
  writeJSON(compiledConfigPath, finalConfig);

  if (process.env.PLATFORM === 'android') {
    updateGradleProperties(finalConfig);
    updateFastlaneConfig(finalConfig);
  }

  if (process.env.PLATFORM === 'ios') {
    updateInfoPlist(finalConfig);
    updatePbxproj(finalConfig);
    copyGoogleServicePlist();
    updateFastlaneConfig(finalConfig);
  }
})();
