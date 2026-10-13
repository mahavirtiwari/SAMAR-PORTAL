import {
  log as crashLog,
  recordError as crashRecordError,
  setAttribute as crashSetAttribute,
  setUserId as crashSetUserId,
  getCrashlytics,
} from '@react-native-firebase/crashlytics';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import AppSettings from '../../appsettings';

// Keys whose values should never be sent to remote logging / Crashlytics
const SENSITIVE_KEYS = [
  'token',
  'accessToken',
  'refreshToken',
  'password',
  'authorization',
  'Authorization',
];

/**
 * Shallow-clone an object and replace sensitive field values with '[REDACTED]'.
 * Safe to call on non-objects (returns the value as-is).
 */
const sanitize = data => {
  if (!data || typeof data !== 'object') {
    return data;
  }
  const sanitized = { ...data };
  SENSITIVE_KEYS.forEach(key => {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  });
  return sanitized;
};

// ANSI color codes
const Colors = {
  RESET: '\x1b[0m',
  BLUE: '\x1b[34m',
  YELLOW: '\x1b[33m',
  RED_BOLD: '\x1b[31;1m',
};

// Log levels and associated colors
const LogLevel = {
  INFO: { level: 'info', color: Colors.BLUE },
  WARN: { level: 'warn', color: Colors.YELLOW },
  ERROR: { level: 'error', color: Colors.RED_BOLD },
};

// Determine if logging is enabled based on environment
const isLoggingEnabled = AppSettings.LOGGING_ENABLED;
const currentLogLevel = AppSettings.LOG_LEVEL || LogLevel.INFO.level;

// Enable Crashlytics for Production, Staging, and Development
const isCrashlyticsEnabled = ['Production', 'Staging', 'Development'].includes(
  AppSettings.ENVIRONMENT,
);

// ============================================================================
// GLOBAL CONTEXT - Persistent attributes attached to ALL errors
// ============================================================================
let globalContext = {};
let currentScreen = 'Unknown';
let sessionStartTime = null;
let isGlobalContextInitialized = false;

// Safe getter for modular Crashlytics instance.
const getCrashlyticsInstance = () => {
  try {
    return getCrashlytics();
  } catch (_e) {
    return null;
  }
};

/**
 * Initialize global context with device and app information.
 * Call this once at app startup (e.g., in App.js or after login).
 * This data will be attached to ALL error reports.
 */
const initializeGlobalContext = async () => {
  if (isGlobalContextInitialized) {
    return;
  }

  try {
    sessionStartTime = Date.now();

    // Gather device info (these are sync methods in newer versions)
    const deviceInfo = {
      // Device
      deviceModel: DeviceInfo.getModel(),
      deviceBrand: DeviceInfo.getBrand(),
      deviceId: DeviceInfo.getDeviceId(),
      isEmulator: await DeviceInfo.isEmulator(),

      // OS
      osName: Platform.OS,
      osVersion: Platform.Version?.toString() || 'Unknown',
      systemVersion: DeviceInfo.getSystemVersion(),

      // App
      appVersion: AppSettings.VERSION_DISPLAY || DeviceInfo.getVersion(),
      buildNumber: AppSettings.BUILD_NUMBER || DeviceInfo.getBuildNumber(),
      bundleId: DeviceInfo.getBundleId(),
      environment: AppSettings.ENVIRONMENT,

      // Memory & Storage (useful for debugging crashes)
      totalMemory: await getFormattedMemory(),
    };

    globalContext = { ...deviceInfo };

    // Set these as persistent attributes in Crashlytics
    if (isCrashlyticsEnabled) {
      const crash = getCrashlyticsInstance();
      if (crash) {
        Object.entries(globalContext).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            crashSetAttribute(crash, key, String(value));
          }
        });
      }
    }

    isGlobalContextInitialized = true;

    if (isLoggingEnabled) {
      console.info(
        `${Colors.BLUE}[Logger] Global context initialized${Colors.RESET}`,
        globalContext,
      );
    }
  } catch (error) {
    // Don't let initialization errors break the app
    if (isLoggingEnabled) {
      console.warn('[Logger] Failed to initialize global context:', error.message);
    }
  }
};

/**
 * Get formatted memory in MB
 */
const getFormattedMemory = async () => {
  try {
    const totalMemory = await DeviceInfo.getTotalMemory();
    return `${Math.round(totalMemory / 1024 / 1024)}MB`;
  } catch {
    return 'Unknown';
  }
};

/**
 * Set the current screen name for error tracking.
 * Call this in your navigation listener or screen focus effects.
 * @param {string} screenName - Name of the current screen
 */
const setCurrentScreen = screenName => {
  if (screenName) {
    currentScreen = screenName;
    if (isCrashlyticsEnabled) {
      const crash = getCrashlyticsInstance();
      if (crash) {
        crashSetAttribute(crash, 'currentScreen', screenName);
        crashLog(crash, `[NAVIGATION] Screen: ${screenName}`);
      }
    }
  }
};

/**
 * Get session duration in seconds
 */
const getSessionDuration = () => {
  if (!sessionStartTime) {
    return 0;
  }
  return Math.round((Date.now() - sessionStartTime) / 1000);
};

/**
 * Build the full error context by merging global + local context.
 * Sensitive fields are redacted before the object is returned.
 */
const buildErrorContext = (localContext = {}) => {
  return sanitize({
    // Global context (device, app info)
    ...globalContext,
    // Runtime context
    currentScreen,
    sessionDurationSec: getSessionDuration(),
    timestamp: new Date().toISOString(),
    // Local context (passed by caller)
    ...localContext,
  });
};

// Check if a specific log level is allowed
const isLogLevelAllowed = level => {
  const levels = ['info', 'warn', 'error'];
  return levels.indexOf(level) >= levels.indexOf(currentLogLevel);
};

// Core logging methods
const logInfo = (message, ...optionalParams) => {
  if (isLoggingEnabled && isLogLevelAllowed(LogLevel.INFO.level)) {
    console.info(`${LogLevel.INFO.color}[INFO]: ${message}${Colors.RESET}`, ...optionalParams);
  }
  // Send to Crashlytics for tracking (Production only)
  if (isCrashlyticsEnabled) {
    const crash = getCrashlyticsInstance();
    if (crash) {
      crashLog(crash, `[INFO] ${message}`);
    }
  }
};

const logWarning = (message, ...optionalParams) => {
  if (isLoggingEnabled && isLogLevelAllowed(LogLevel.WARN.level)) {
    console.warn(`${LogLevel.WARN.color}[WARNING]: ${message}${Colors.RESET}`, ...optionalParams);
  }
  // Send to Crashlytics for tracking (Production only)
  if (isCrashlyticsEnabled) {
    const crash = getCrashlyticsInstance();
    if (crash) {
      crashLog(crash, `[WARN] ${message}`);
    }
  }
};

const logError = (message, ...optionalParams) => {
  if (isLoggingEnabled && isLogLevelAllowed(LogLevel.ERROR.level)) {
    console.error(`${LogLevel.ERROR.color}[ERROR]: ${message}${Colors.RESET}`, ...optionalParams);
  }

  // Send error to Crashlytics as a non-fatal error (Production/Staging only)
  if (isCrashlyticsEnabled) {
    const errorDetails = optionalParams.length > 0 ? optionalParams[0] : null;

    // Build context with global + any object passed as second param
    const localContext =
      optionalParams.length > 1 && typeof optionalParams[1] === 'object' ? optionalParams[1] : {};

    // Extract error info if available
    const errorContext = {
      errorType: 'AppError',
      errorMessage: message,
      ...localContext,
    };

    if (errorDetails instanceof Error) {
      errorContext.errorName = errorDetails.name;
      errorContext.errorStack = errorDetails.stack?.slice(0, 500);
      if (errorDetails.code) {
        errorContext.errorCode = errorDetails.code;
      }
    }

    const crash = getCrashlyticsInstance();
    if (crash) {
      // Merge with global context and set attributes
      const fullContext = buildErrorContext(errorContext);
      Object.entries(fullContext).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          crashSetAttribute(crash, key, String(value));
        }
      });

      // Record the error
      if (errorDetails instanceof Error) {
        crashRecordError(crash, errorDetails);
      } else {
        const error = new Error(message);
        error.name = 'AppError';
        crashRecordError(crash, error);
      }

      // Also log the message for context breadcrumb
      crashLog(crash, `[ERROR] ${message}`);
    }
  }
};

/**
 * Record a non-fatal error with additional context
 * Use this for API errors, survey submission errors, etc.
 * This automatically includes global context (device info, screen, session duration).
 *
 * @param {Error|string} error - The error object or message
 * @param {Object} context - Additional context (surveyId, userId, action, etc.)
 *
 * @example
 * Logger.recordError(error, {
 *   errorType: 'SurveySubmitError',
 *   action: 'submitSurvey',
 *   surveyId: '123',
 *   userAction: 'tap_submit_button'
 * });
 */
const recordError = (error, context = {}) => {
  // Only send to Crashlytics in Production/Staging
  if (isCrashlyticsEnabled) {
    // Extract additional info from Error object
    const errorInfo = {};
    if (error instanceof Error) {
      errorInfo.errorName = error.name;
      errorInfo.errorMessage = error.message;
      if (error.code) {
        errorInfo.errorCode = error.code;
      }
      // Include truncated stack for context
      if (error.stack) {
        errorInfo.errorStack = error.stack.slice(0, 500);
      }
    } else {
      errorInfo.errorMessage = String(error);
    }

    // Build full context: global + error info + local context
    const fullContext = buildErrorContext({
      ...errorInfo,
      ...context,
    });

    const crash = getCrashlyticsInstance();
    if (crash) {
      // Set all attributes in Crashlytics
      Object.entries(fullContext).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          crashSetAttribute(crash, key, String(value));
        }
      });

      const errorObj = error instanceof Error ? error : new Error(String(error));
      crashRecordError(crash, errorObj);
    }
  }

  // Also log to console if enabled
  if (isLoggingEnabled) {
    const fullContext = buildErrorContext(context);
    console.error(
      `${Colors.RED_BOLD}[RECORDED ERROR]: ${error?.message || error}${Colors.RESET}`,
      fullContext,
    );
  }
};

/**
 * Set user identifier for crash reports
 * @param {string} userId - User's unique identifier
 */
const setUserId = userId => {
  if (userId && isCrashlyticsEnabled) {
    try {
      const crash = getCrashlyticsInstance();
      if (crash) {
        crashSetUserId(crash, String(userId));
      }
    } catch (e) {
      // Don't let Crashlytics errors break app functionality
      if (isLoggingEnabled) {
        console.warn('[Logger] Failed to set userId:', e.message);
      }
    }
  }
};

/**
 * Set custom attributes for crash reports
 * @param {Object} attributes - Key-value pairs of attributes
 */
const setAttributes = (attributes = {}) => {
  if (!isCrashlyticsEnabled) {
    return;
  }

  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      const crash = getCrashlyticsInstance();
      if (crash) {
        crashSetAttribute(crash, key, String(value));
      }
    }
  });
};

/**
 * Log a custom message to Crashlytics (visible in crash/error reports)
 * @param {string} message - Message to log
 */
const logToCrashlytics = message => {
  if (isCrashlyticsEnabled) {
    const crash = getCrashlyticsInstance();
    if (crash) {
      crashLog(crash, message);
    }
  }
};

export const Logger = {
  // Core logging
  info: logInfo,
  warn: logWarning,
  error: logError,

  // Enhanced error recording with full context
  recordError,

  // User & session management
  setUserId,
  setAttributes,

  // Global context initialization (call once at app startup)
  initializeGlobalContext,

  // Screen tracking (call on navigation)
  setCurrentScreen,

  // Crashlytics direct access
  logToCrashlytics,

  // Utilities
  getSessionDuration,
};
