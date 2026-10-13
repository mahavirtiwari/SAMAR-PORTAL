/**
 * ================================================================
 *                          Prebuild Script
 * ================================================================
 *
 * This script automates the configuration setup for your React
 * project based on the specified environment (Local, Staging, or Production).
 *
 * It performs the following tasks:
 *
 * 1. **Determine the Environment:**
 *    - Reads the command line argument or NODE_ENV to identify the current
 *      environment (`Local`, `Staging`, or `Production`).
 *    - Defaults to `Local` if not set.
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
 *    - Writes the merged configuration to `appsettings.Compiled.json`.
 *
 * ---------------------------------------------------------------
 *                      Usage
 * ---------------------------------------------------------------
 *
 * node scripts/prebuild.js [Environment]
 *
 * Examples:
 *   node scripts/prebuild.js Local
 *   node scripts/prebuild.js Staging
 *   node scripts/prebuild.js Production
 *
 * ================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Determine the environment from command line argument or NODE_ENV
const ENV = process.argv[2] || process.env.NODE_ENV || 'Local';

// Paths to configuration files (relative to src directory)
const srcDir = path.resolve(__dirname, '..', 'src');
const baseConfigPath = path.resolve(srcDir, 'appsettings.json');
const envConfigPath = path.resolve(srcDir, `appsettings.${ENV}.json`);
const compiledConfigPath = path.resolve(srcDir, 'appsettings.Compiled.json');

/**
 * Load and parse a JSON configuration file.
 */
function loadJSON(filePath, required = true) {
  if (!fs.existsSync(filePath)) {
    if (required) {
      console.error(`Error: Configuration file not found: ${filePath}`);
      process.exit(1);
    }
    return {};
  }
  const data = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error parsing JSON file: ${filePath}\n${error}`);
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
    console.error(`Error writing to file: ${filePath}\n${error}`);
    process.exit(1);
  }
}

/**
 * Short git SHA of HEAD, with a "-dirty" suffix when uncommitted changes would
 * ship in the build. Null when git is unavailable (e.g. a source tarball).
 */
function gitCommit() {
  const repoRoot = path.resolve(__dirname, '..');
  const git = (args) =>
    execSync(`git ${args}`, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  try {
    const sha = git('rev-parse --short HEAD');
    return git('status --porcelain') ? `${sha}-dirty` : sha;
  } catch {
    return null;
  }
}

/**
 * Main execution function.
 */
(function main() {
  console.log(`Building configuration for environment: ${ENV}`);

  // Load base configuration
  const baseConfig = loadJSON(baseConfigPath);
  console.log(`Loaded base config from: appsettings.json`);

  // Load environment-specific configuration
  // For 'Local' environment, the env config file is optional
  const envConfig = loadJSON(envConfigPath, ENV !== 'Local');
  if (Object.keys(envConfig).length > 0) {
    console.log(`Loaded environment config from: appsettings.${ENV}.json`);
  }

  // Merge configurations (environment overrides base)
  const finalConfig = mergeConfigs(baseConfig, envConfig);

  // Generate a shared buildTime stamped into both the bundle and version.json
  const buildTime = new Date().toISOString();
  finalConfig.BUILD_TIME = buildTime;

  // Stamp the source commit so a deployed build is traceable to a git SHA
  // (read back by deploy.sh's parity check via /version.json).
  const commit = gitCommit();
  finalConfig.COMMIT = commit;

  // Write compiled configuration (BUILD_TIME gets baked into the JS bundle)
  writeJSON(compiledConfigPath, finalConfig);
  console.log(`Generated: appsettings.Compiled.json`);

  // Generate public/version.json for runtime version detection
  const publicDir = path.resolve(__dirname, '..', 'public');
  const versionFilePath = path.resolve(publicDir, 'version.json');
  const versionData = {
    version: finalConfig.VERSION || '0.0.0',
    buildTime: buildTime,
    commit: commit,
  };
  writeJSON(versionFilePath, versionData);
  console.log(`Generated: public/version.json (v${versionData.version}, commit ${commit || 'unknown'})`);

  console.log(`Configuration compiled successfully for ${ENV} environment.`);
})();
