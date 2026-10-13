import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import {
  addCommitteeMeetingAction,
  cancelCommitteeMeetingAction,
  completeCommitteeMeetingAction,
  getCommitteeMeetingByIdAction,
  getCommitteeMeetingsAction,
  startCommitteeMeetingAction,
  updateCommitteeMeetingAction,
} from '../../action/operationsAdmin/CommitteeMeetingAction';

const initialState = {
  meetings: [],
  meetingsPagination: null,
  meetingsLoading: false,
  meetingsError: null,

  // Single meeting details
  currentMeeting: null,
  currentMeetingLoading: false,
  currentMeetingError: null,

  // meta for create/update/delete
  createLoading: false,
  createError: null,
  updateLoading: false,
  updateError: null,
  cancelLoading: false,
  cancelError: null,

  // Start/Complete meeting
  startLoading: false,
  startError: null,
  completeLoading: false,
  completeError: null,
};

const committeeMeetingSlice = createSlice({
  name: 'CommitteeMeeting',
  initialState,
  reducers: {
    resetCommitteeMeetingState(state) {
      state.meetingsError = null;
      state.currentMeetingError = null;
      state.createError = null;
      state.updateError = null;
      state.cancelError = null;
      state.startError = null;
      state.completeError = null;
    },
    clearCommitteeMeetings(state) {
      state.meetings = [];
    },
    clearCurrentMeeting(state) {
      state.currentMeeting = null;
      state.currentMeetingError = null;
    },
  },
  extraReducers: builder => {
    builder
      // GET meetings
      .addCase(getCommitteeMeetingsAction.pending, state => {
        state.meetingsLoading = true;
        state.meetingsError = null;
      })
      .addCase(getCommitteeMeetingsAction.fulfilled, (state, action) => {
        state.meetingsLoading = false;
        state.meetings = action.payload?.data ?? action.payload ?? [];
        state.meetingsPagination = action.payload?.pagination ?? null;
        Logger.info('Committee meetings loaded successfully in slice');
      })
      .addCase(getCommitteeMeetingsAction.rejected, (state, action) => {
        state.meetingsLoading = false;
        state.meetingsError = action.payload;
        Logger.error('Get committee meetings failed in slice:', action.payload);
      })

      // ADD meeting
      .addCase(addCommitteeMeetingAction.pending, state => {
        state.createLoading = true;
        state.createError = null;
      })
      .addCase(addCommitteeMeetingAction.fulfilled, (state, action) => {
        state.createLoading = false;
        if (action.payload) {
          state.meetings.unshift(action.payload);
        }
        Logger.info('Committee meeting added successfully in slice');
      })
      .addCase(addCommitteeMeetingAction.rejected, (state, action) => {
        state.createLoading = false;
        state.createError = action.payload;
        Logger.error('Add committee meeting failed in slice:', action.payload);
      })

      // UPDATE meeting
      .addCase(updateCommitteeMeetingAction.pending, state => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updateCommitteeMeetingAction.fulfilled, (state, action) => {
        state.updateLoading = false;
        const updated = action.payload;
        if (updated && updated.id) {
          const idx = state.meetings.findIndex(m => String(m.id) === String(updated.id));
          if (idx > -1) {
            state.meetings[idx] = updated;
          }
        }
        Logger.info('Committee meeting updated successfully in slice');
      })
      .addCase(updateCommitteeMeetingAction.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload;
        Logger.error('Update committee meeting failed in slice:', action.payload);
      })

      // CANCEL meeting
      .addCase(cancelCommitteeMeetingAction.pending, state => {
        state.cancelLoading = true;
        state.cancelError = null;
      })
      .addCase(cancelCommitteeMeetingAction.fulfilled, (state, action) => {
        state.cancelLoading = false;
        const cancelled = action.payload?.meeting ?? action.payload;
        if (cancelled && cancelled.id) {
          const idx = state.meetings.findIndex(m => String(m.id) === String(cancelled.id));
          if (idx > -1) {
            state.meetings[idx] = { ...state.meetings[idx], ...cancelled, status: 'cancelled' };
          }
        }
        Logger.info('Committee meeting cancelled successfully in slice');
      })
      .addCase(cancelCommitteeMeetingAction.rejected, (state, action) => {
        state.cancelLoading = false;
        state.cancelError = action.payload;
        Logger.error('Cancel committee meeting failed in slice:', action.payload);
      })

      // GET meeting by ID
      .addCase(getCommitteeMeetingByIdAction.pending, state => {
        state.currentMeetingLoading = true;
        state.currentMeetingError = null;
      })
      .addCase(getCommitteeMeetingByIdAction.fulfilled, (state, action) => {
        state.currentMeetingLoading = false;
        state.currentMeeting = action.payload?.meeting ?? action.payload;
        Logger.info('Committee meeting loaded successfully in slice');
      })
      .addCase(getCommitteeMeetingByIdAction.rejected, (state, action) => {
        state.currentMeetingLoading = false;
        state.currentMeetingError = action.payload;
        Logger.error('Get committee meeting by ID failed in slice:', action.payload);
      })

      // START meeting
      .addCase(startCommitteeMeetingAction.pending, state => {
        state.startLoading = true;
        state.startError = null;
      })
      .addCase(startCommitteeMeetingAction.fulfilled, (state, action) => {
        state.startLoading = false;
        const updated = action.payload?.meeting ?? action.payload;
        if (updated) {
          state.currentMeeting = updated;
          // Also update in meetings list if present
          if (updated.id) {
            const idx = state.meetings.findIndex(m => String(m.id) === String(updated.id));
            if (idx > -1) {
              state.meetings[idx] = { ...state.meetings[idx], ...updated };
            }
          }
        }
        Logger.info('Committee meeting started successfully in slice');
      })
      .addCase(startCommitteeMeetingAction.rejected, (state, action) => {
        state.startLoading = false;
        state.startError = action.payload;
        Logger.error('Start committee meeting failed in slice:', action.payload);
      })

      // COMPLETE meeting
      .addCase(completeCommitteeMeetingAction.pending, state => {
        state.completeLoading = true;
        state.completeError = null;
      })
      .addCase(completeCommitteeMeetingAction.fulfilled, (state, action) => {
        state.completeLoading = false;
        const updated = action.payload?.meeting ?? action.payload;
        if (updated) {
          state.currentMeeting = updated;
          // Also update in meetings list if present
          if (updated.id) {
            const idx = state.meetings.findIndex(m => String(m.id) === String(updated.id));
            if (idx > -1) {
              state.meetings[idx] = { ...state.meetings[idx], ...updated };
            }
          }
        }
        Logger.info('Committee meeting completed successfully in slice');
      })
      .addCase(completeCommitteeMeetingAction.rejected, (state, action) => {
        state.completeLoading = false;
        state.completeError = action.payload;
        Logger.error('Complete committee meeting failed in slice:', action.payload);
      });
  },
});

export const { resetCommitteeMeetingState, clearCommitteeMeetings, clearCurrentMeeting } = committeeMeetingSlice.actions;
export default committeeMeetingSlice.reducer;
