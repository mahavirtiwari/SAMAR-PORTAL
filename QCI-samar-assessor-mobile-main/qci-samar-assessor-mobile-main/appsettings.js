import compiledConfig from './appsettings.Compiled.json';

const AppSettings = {
  ENVIRONMENT: compiledConfig.ENVIRONMENT,
  APP_NAME: compiledConfig.APP_NAME,
  APP_ID: compiledConfig.APP_ID,
  VERSION_DISPLAY: compiledConfig.VERSION_DISPLAY,
  VERSION_INTERNAL: compiledConfig.VERSION_INTERNAL,
  COMMIT: compiledConfig.COMMIT,
  BUILD_TIME: compiledConfig.BUILD_TIME,
  BASE_URL: compiledConfig.BASE_URL,
  LOGGING_ENABLED: compiledConfig.LOGGING_ENABLED,
  LOG_LEVEL: compiledConfig.LOG_LEVEL
};

export default AppSettings;
