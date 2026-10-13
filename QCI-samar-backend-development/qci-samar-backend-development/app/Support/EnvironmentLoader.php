<?php

namespace App\Support;

class EnvironmentLoader
{
    /**
     * Load environment files using .NET appsettings pattern.
     *
     * Loading Strategy (like .NET's appsettings.json + appsettings.{Environment}.json):
     * 1. Load .env as the BASE configuration (common settings)
     * 2. Load .env.{APP_ENV} and MERGE/OVERRIDE on top (environment-specific settings)
     *
     * This means:
     * - Common settings (APP_VERSION, MAIL_*, etc.) go in .env only
     * - Environment-specific settings (APP_URL, DB_*, APP_DEBUG, etc.) go in .env.{environment}
     * - Environment-specific values override base values
     *
     * Scenarios:
     * - Local dev (no APP_ENV or APP_ENV=local) → loads .env only
     * - Azure dev (APP_ENV=development) → loads .env, then merges .env.development
     * - Azure prod (APP_ENV=production) → loads .env, then merges .env.production
     * - Linux server (APP_ENV=staging) → loads .env, then merges .env.staging
     *
     * IMPORTANT: Values are set in $_ENV, $_SERVER, and putenv() because:
     * - Laravel's vlucas/phpdotenv checks $_SERVER FIRST, then $_ENV
     * - Azure App Settings populate $_SERVER before PHP starts
     * - We must set $_SERVER to ensure .env values override Azure App Settings
     *
     * With this approach, you only need to set APP_ENV in Azure App Settings.
     * All other values come from the .env files.
     */
    public static function forceLoadDotenv(string $basePath): void
    {
        // Step 1: Get APP_ENV from SYSTEM environment FIRST (before loading any .env)
        // This is critical - system env takes precedence over .env files
        $appEnv = getenv('APP_ENV') ?: null;

        // Step 2: Always load .env as the base configuration
        if (file_exists("$basePath/.env")) {
            self::loadEnvFile($basePath, '.env');
        }

        // Step 3: If no system APP_ENV, check what .env loaded
        if ($appEnv === null) {
            $appEnv = $_ENV['APP_ENV'] ?? null;
        }

        // Step 4: If we have a specific environment (not local), merge the override file
        if ($appEnv !== null && $appEnv !== 'local') {
            $envSpecificFile = ".env.$appEnv";

            if (file_exists("$basePath/$envSpecificFile")) {
                self::loadEnvFile($basePath, $envSpecificFile);
            }
        }
    }

    /**
     * Parse and load an environment file.
     * Values loaded later will override earlier values (merge behavior).
     */
    private static function loadEnvFile(string $basePath, string $envFile): void
    {
        $lines = file("$basePath/$envFile", FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        foreach ($lines as $line) {
            // Skip comments and empty lines
            if (strpos(trim($line), '#') === 0 || trim($line) === '') {
                continue;
            }

            // Parse key=value
            if (strpos($line, '=') !== false) {
                [$key, $value] = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);

                // Remove quotes from value
                $value = trim($value, '"\'');

                // Handle variable expansion like ${VAR}
                if (preg_match('/\$\{([A-Z_]+)\}/', $value, $matches)) {
                    $varName = $matches[1];
                    $varValue = $_ENV[$varName] ?? getenv($varName) ?: '';
                    $value = str_replace($matches[0], $varValue, $value);
                }

                // Set in $_ENV (which Laravel's env() function reads from)
                $_ENV[$key] = $value;

                // Set in $_SERVER (Laravel's dotenv checks $_SERVER FIRST, before $_ENV)
                // This is critical for Azure App Service where App Settings populate $_SERVER
                $_SERVER[$key] = $value;

                // Also set with putenv for compatibility with getenv()
                putenv("$key=$value");
            }
        }
    }
}
