import { createSlice } from '@reduxjs/toolkit';
import { getApplications, getStepProgress } from '../action/applicationAction';

const initialState = {
  applications: [],
  applicationsLoading: false,
  applicationsError: null,
  stepProgress: null,
  stepProgressLoading: false,
  stepProgressError: null,
};

const ApplicationSlice = createSlice({
  name: 'application',
  initialState,
  reducers: {
    resetStepProgressState(state) {
      state.stepProgress = null;
      state.stepProgressError = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(getApplications.pending, state => {
        state.applicationsLoading = true;
        state.applicationsError = null;
      })
      .addCase(getApplications.fulfilled, (state, action) => {
        state.applicationsLoading = false;
        // Only scheduled-or-later assessments are surfaced in the applicant app.
        // A scheduled start date is set at the schedule transition and persists
        // through in_progress and certified, so its presence is that signal;
        // drafts and not-yet-scheduled applications are hidden.
        state.applications = (action.payload || []).filter(
          application => !!application.assessmentScheduledStartDate,
        );
      })
      .addCase(getApplications.rejected, (state, action) => {
        state.applicationsLoading = false;
        state.applicationsError = action.payload || action.error.message;
      });

    builder
      .addCase(getStepProgress.pending, state => {
        state.stepProgressLoading = true;
        state.stepProgressError = null;
      })
      .addCase(getStepProgress.fulfilled, (state, action) => {
        state.stepProgressLoading = false;
        state.stepProgress = action.payload;
      })
      .addCase(getStepProgress.rejected, (state, action) => {
        state.stepProgressLoading = false;
        state.stepProgressError = action.payload || action.error.message;
        // Keep the last-known-good progress: an offline refresh (which rejects)
        // must not wipe the unlock state and re-lock steps the applicant already
        // reached. Explicit clearing is available via resetStepProgressState.
      });
  },
});

export const { resetStepProgressState } = ApplicationSlice.actions;
export default ApplicationSlice.reducer;
