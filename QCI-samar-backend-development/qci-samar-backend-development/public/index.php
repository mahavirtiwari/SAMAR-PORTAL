<?php

use App\Support\EnvironmentLoader;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Force load environment files BEFORE autoloader (uses .NET appsettings pattern)
// This ensures environment-specific .env.{APP_ENV} overrides base .env
require_once __DIR__.'/../app/Support/EnvironmentLoader.php';
EnvironmentLoader::forceLoadDotenv(dirname(__DIR__));

// Register the Composer autoloader...
require __DIR__.'/../vendor/autoload.php';

// Bootstrap Laravel and handle the request...
(require_once __DIR__.'/../bootstrap/app.php')
    ->handleRequest(Request::capture());
