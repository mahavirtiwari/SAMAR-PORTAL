import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../../utils/logger';
import { getAuditLogsAction } from '../../../action/systemAdmin/auditLog/AuditLogAction';

const initialState = {
  auditLogs: [],
  auditLogsPagination: null,
  auditLogsLoading: false,
  auditLogsError: null,
};

const auditLogSlice = createSlice({
  name: 'systemAdminAuditLog',
  initialState,

  reducers: {},

  extraReducers: builder => {
    builder
      .addCase(getAuditLogsAction.pending, state => {
        state.auditLogsLoading = true;
        state.auditLogsError = null;
      })
      .addCase(getAuditLogsAction.fulfilled, (state, action) => {
        state.auditLogsLoading = false;
        state.auditLogs = action.payload?.data || [];
        state.auditLogsPagination = action.payload?.pagination || null;
      })
      .addCase(getAuditLogsAction.rejected, (state, action) => {
        state.auditLogsLoading = false;
        state.auditLogsError = action.payload;
        Logger.error('Get audit logs failed in slice:', action.payload);
      });
  },
});

export default auditLogSlice.reducer;
