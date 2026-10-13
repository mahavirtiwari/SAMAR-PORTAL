import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

// Public, unauthenticated status check used to gate the whole app on startup.
export const checkSystemStatusAction = createAsyncThunk('systemStatus/check', async () => {
  const status = await Api.SystemStatus.getSystemStatus();
  Logger.info('System status checked:', status);
  return status;
});
