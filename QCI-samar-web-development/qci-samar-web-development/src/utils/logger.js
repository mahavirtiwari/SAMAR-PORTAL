import AppSettings from '../appsettings';

// CSS styles for web console
const Styles = {
  INFO: 'color: #2196F3; font-weight: bold',
  WARN: 'color: #FF9800; font-weight: bold',
  ERROR: 'color: #F44336; font-weight: bold',
};

// Log levels
const LogLevel = {
  INFO: { level: 'info', style: Styles.INFO },
  WARN: { level: 'warn', style: Styles.WARN },
  ERROR: { level: 'error', style: Styles.ERROR },
};

// Determine if logging is enabled based on environment
const isLoggingEnabled = AppSettings.LOGGING_ENABLED;
const currentLogLevel = AppSettings.LOG_LEVEL || LogLevel.INFO.level;

// Check if a specific log level is allowed
const isLogLevelAllowed = level => {
  const levels = ['info', 'warn', 'error'];
  const currentLevel = currentLogLevel.toLowerCase();
  return levels.indexOf(level) >= levels.indexOf(currentLevel);
};

// Core logging methods
const logInfo = (message, ...optionalParams) => {
  if (isLoggingEnabled && isLogLevelAllowed(LogLevel.INFO.level)) {
    console.info(`%c[INFO]: ${message}`, LogLevel.INFO.style, ...optionalParams);
  }
};

const logWarning = (message, ...optionalParams) => {
  if (isLoggingEnabled && isLogLevelAllowed(LogLevel.WARN.level)) {
    console.warn(`%c[WARNING]: ${message}`, LogLevel.WARN.style, ...optionalParams);
  }
};

const logError = (message, ...optionalParams) => {
  if (isLoggingEnabled && isLogLevelAllowed(LogLevel.ERROR.level)) {
    console.error(`%c[ERROR]: ${message}`, LogLevel.ERROR.style, ...optionalParams);
  }
  // TODO: Send errors to a remote logging service
};

export const Logger = {
  info: logInfo,
  warn: logWarning,
  error: logError,
};
