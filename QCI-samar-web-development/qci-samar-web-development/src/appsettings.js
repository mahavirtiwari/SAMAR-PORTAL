import compiledConfig from './appsettings.Compiled.json';

const AppSettings = {
  // Core App Settings
  ENVIRONMENT: compiledConfig.ENVIRONMENT,
  VERSION: compiledConfig.VERSION,
  BASE_URL: compiledConfig.BASE_URL,
  LOGGING_ENABLED: compiledConfig.LOGGING_ENABLED ?? true,
  LOG_LEVEL: compiledConfig.LOG_LEVEL,

  // API Configuration
  DEFAULT_TIMEOUT: compiledConfig.DEFAULT_TIMEOUT,
  MAX_RETRY_ATTEMPTS: compiledConfig.MAX_RETRY_ATTEMPTS,

  // Security
  ENCRYPTION_KEY: compiledConfig.ENCRYPTION_KEY,

  // All other config values
  ...compiledConfig,
};

export default AppSettings;
