import { createSlice } from '@reduxjs/toolkit';
import { checkSystemStatusAction } from '../../action/common/SystemStatusAction';

const initialState = {
  maintenanceMode: false,
  applicationSubmissionOpen: true,
  maintenanceMessage: null,
  statusChecked: false,
};

const systemStatusSlice = createSlice({
  name: 'systemStatus',
  initialState,
  reducers: {
    // Flipped by the authed client when a request returns a 503 maintenance response,
    // so the router gate can render the Maintenance screen without a hard reload.
    setMaintenanceMode: (state, action) => {
      state.maintenanceMode = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(checkSystemStatusAction.fulfilled, (state, action) => {
        state.maintenanceMode = action.payload?.maintenanceMode ?? false;
        state.applicationSubmissionOpen = action.payload?.applicationSubmissionOpen ?? true;
        state.maintenanceMessage = action.payload?.maintenanceMessage ?? null;
        state.statusChecked = true;
      })
      .addCase(checkSystemStatusAction.rejected, state => {
        state.statusChecked = true;
      });
  },
});

export const { setMaintenanceMode } = systemStatusSlice.actions;
export default systemStatusSlice.reducer;
