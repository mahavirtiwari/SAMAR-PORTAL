import { Logger } from './logger';

let installed = false;

export function installGlobalErrorHandler() {
  if (installed || !global.ErrorUtils) {
    return;
  }
  installed = true;

  const previousHandler = global.ErrorUtils.getGlobalHandler();

  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      Logger.recordError(error, {
        source: 'globalErrorHandler',
        isFatal: Boolean(isFatal)
      });
    } catch {
      // best-effort reporting; never throw from the handler
    }
    if (previousHandler) {
      previousHandler(error, isFatal);
    }
  });
}
