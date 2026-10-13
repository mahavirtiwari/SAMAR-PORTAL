import { createSlice } from '@reduxjs/toolkit';
import {
  getAllAssessmentsAction,
  getAllAttendanceAction,
  getAssessmentByIdAction,
  getAttendanceStatusAction,
  getDashboardDataAction,
  getStepProgressAction,
  punchInAction,
  punchOutAction,
  syncAssessmentsFromServerAction
} from '../action/assessmentAction';

const initialState = {
  // Get All Assessments
  allAssessmentsLoading: false,
  allAssessmentsError: null,
  allAssessments: null,

  // Get Assessment By ID
  assessmentDataLoading: false,
  assessmentDataError: null,
  assessmentData: null,

  // Server id of an assessment the backend just reported as rescheduled, so
  // the open detail screen can bounce the assessor back to Home. Cleared on
  // consume via clearRescheduledFlag.
  rescheduledAssessmentId: null,

  // Get All Attendance
  allAttendanceLoading: false,
  allAttendanceError: null,
  allAttendance: null,

  // Get Attendance Status
  attendanceStatusLoading: false,
  attendanceStatusError: null,
  attendanceStatus: null,

  // Punch In
  punchInLoading: false,
  punchInError: null,
  punchInData: null,

  // Punch Out
  punchOutLoading: false,
  punchOutError: null,
  punchOutData: null,

  // Get Step Progress
  stepProgressLoading: false,
  stepProgressError: null,
  stepProgress: null,
  // The assessmentId of the most recently REQUESTED step-progress fetch.
  // stepProgress is a single shared slot, but its fetch begins with a (possibly
  // slow) network sync — so a fetch kicked off for a previously-open assessment
  // can resolve AFTER the user has opened a different one and clobber its data
  // (e.g. a completed assessment's "all done" steps bleeding onto a freshly
  // opened scheduled one). We stamp each request's id on pending and only accept
  // a fulfilled/rejected result whose id still matches the latest request.
  stepProgressAssessmentId: null,

  getDashboardLoading: false,
  getDashboardError: null,
  getDashboardData: null
};

const assessmentSlice = createSlice({
  name: 'assessment',
  initialState,
  reducers: {
    // Reset individual states
    resetAllAssessmentsState: (state) => {
      state.allAssessmentsLoading = false;
      state.allAssessmentsError = null;
      state.allAssessments = null;
    },
    resetAssessmentByIdState: (state) => {
      state.assessmentData = null;
      state.assessmentDataLoading = false;
      state.assessmentDataError = null;
    },
    resetAllAttendanceState: (state) => {
      state.allAttendanceLoading = false;
      state.allAttendanceError = null;
      state.allAttendance = null;
    },
    resetAttendanceStatusState: (state) => {
      state.attendanceStatusLoading = false;
      state.attendanceStatusError = null;
      state.attendanceStatus = null;
    },
    resetPunchInState: (state) => {
      state.punchInLoading = false;
      state.punchInError = null;
      state.punchInData = null;
    },
    resetPunchOutState: (state) => {
      state.punchOutLoading = false;
      state.punchOutError = null;
      state.punchOutData = null;
    },
    resetAssessmentParametersState: (state) => {
      state.assessmentParametersLoading = false;
      state.assessmentParametersError = null;
      state.assessmentParameters = null;
    },
    resetStepProgressState: (state) => {
      state.stepProgressLoading = false;
      state.stepProgressError = null;
      state.stepProgress = null;
      state.stepProgressAssessmentId = null;
    },
    clearRescheduledFlag: (state) => {
      state.rescheduledAssessmentId = null;
    },

    // Reset entire assessment state
    resetAssessmentState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // Get All Assessments
      .addCase(getAllAssessmentsAction.pending, (state) => {
        state.allAssessmentsLoading = true;
        state.allAssessmentsError = null;
      })
      .addCase(getAllAssessmentsAction.fulfilled, (state, action) => {
        state.allAssessmentsLoading = false;
        state.allAssessments = action.payload;
        state.allAssessmentsError = null;
      })
      .addCase(getAllAssessmentsAction.rejected, (state, action) => {
        state.allAssessmentsLoading = false;
        state.allAssessmentsError = action.payload;
        state.allAssessments = null;
      })
      // The background sync-down publishes the refreshed mirror without
      // touching the loading flag, so the list already on screen never blinks;
      // a failed sync leaves that list as it is.
      .addCase(syncAssessmentsFromServerAction.fulfilled, (state, action) => {
        state.allAssessments = action.payload;
        state.allAssessmentsError = null;
      })

      // Get Assessment By ID
      .addCase(getAssessmentByIdAction.pending, (state) => {
        state.assessmentDataLoading = true;
        state.assessmentDataError = null;
      })
      .addCase(getAssessmentByIdAction.fulfilled, (state, action) => {
        state.assessmentDataLoading = false;
        state.assessmentData = action.payload;
        state.assessmentDataError = null;
        if (action.payload?.rescheduled) {
          state.rescheduledAssessmentId = action.payload?.assessment?.id ?? null;
        }
      })
      .addCase(getAssessmentByIdAction.rejected, (state, action) => {
        state.assessmentDataLoading = false;
        state.assessmentDataError = action.payload;
        state.assessmentData = null;
      })

      // Get All Attendance
      .addCase(getAllAttendanceAction.pending, (state) => {
        state.allAttendanceLoading = true;
        state.allAttendanceError = null;
      })
      .addCase(getAllAttendanceAction.fulfilled, (state, action) => {
        state.allAttendanceLoading = false;
        state.allAttendance = action.payload;
        state.allAttendanceError = null;
      })
      .addCase(getAllAttendanceAction.rejected, (state, action) => {
        state.allAttendanceLoading = false;
        state.allAttendanceError = action.payload;
        state.allAttendance = null;
      })

      // Get Attendance Status
      .addCase(getAttendanceStatusAction.pending, (state) => {
        state.attendanceStatusLoading = true;
        state.attendanceStatusError = null;
      })
      .addCase(getAttendanceStatusAction.fulfilled, (state, action) => {
        state.attendanceStatusLoading = false;
        state.attendanceStatus = action.payload;
        state.attendanceStatusError = null;
      })
      .addCase(getAttendanceStatusAction.rejected, (state, action) => {
        state.attendanceStatusLoading = false;
        state.attendanceStatusError = action.payload;
        // Keep the last known status: nulling it reads as "not punched in"
        // and a transient fetch failure flipped the screen back to Punch-In.
      })

      // Punch In
      .addCase(punchInAction.pending, (state) => {
        state.punchInLoading = true;
        state.punchInError = null;
      })
      .addCase(punchInAction.fulfilled, (state, action) => {
        state.punchInLoading = false;
        state.punchInData = action.payload;
        state.punchInError = null;
        // Optimistically reflect the punch immediately so the UI flips to
        // Punch-Out without waiting on (and regardless of) the follow-up
        // getAttendanceStatus round-trip, which can lag or return stale
        // server state while the punch is still queued for sync. arg carries
        // the lat/long/time the user just punched with.
        const arg = action.meta?.arg || {};
        state.attendanceStatus = {
          isPunchedIn: true,
          isPending: true,
          lastAttendance: {
            type: 'punch_in',
            recordedAt: new Date().toISOString(),
            latitude: arg.latitude,
            longitude: arg.longitude,
            // The locally captured selfie (durable file:// path) so the avatar
            // renders immediately and offline, before the status round-trip.
            selfiePath: arg.selfieUri
          },
          source: 'optimistic'
        };
      })
      .addCase(punchInAction.rejected, (state, action) => {
        state.punchInLoading = false;
        state.punchInError = action.payload;
        state.punchInData = null;
      })

      // Punch Out
      .addCase(punchOutAction.pending, (state) => {
        state.punchOutLoading = true;
        state.punchOutError = null;
      })
      .addCase(punchOutAction.fulfilled, (state, action) => {
        state.punchOutLoading = false;
        state.punchOutData = action.payload;
        state.punchOutError = null;
        // Optimistically clear the punched-in state (see punchInAction above).
        const arg = action.meta?.arg || {};
        state.attendanceStatus = {
          isPunchedIn: false,
          isPending: true,
          lastAttendance: {
            type: 'punch_out',
            recordedAt: new Date().toISOString(),
            latitude: arg.latitude,
            longitude: arg.longitude,
            // The locally captured selfie (durable file:// path) so the avatar
            // renders immediately and offline, before the status round-trip.
            selfiePath: arg.selfieUri
          },
          source: 'optimistic'
        };
      })
      .addCase(punchOutAction.rejected, (state, action) => {
        state.punchOutLoading = false;
        state.punchOutError = action.payload;
        state.punchOutData = null;
      })

      // Get Assessment Parameters

      // Get Step Progress
      .addCase(getStepProgressAction.pending, (state, action) => {
        // Stamp the requested assessment so a later-arriving result for a
        // different (previously open) assessment can be discarded.
        state.stepProgressAssessmentId = action.meta.arg;
        state.stepProgressLoading = true;
        state.stepProgressError = null;
      })
      .addCase(getStepProgressAction.fulfilled, (state, action) => {
        // Ignore a stale fetch that resolved after the user moved to another
        // assessment — otherwise it clobbers the current one's step progress
        // (e.g. a completed assessment's steps bleeding onto a scheduled one).
        if (action.meta.arg !== state.stepProgressAssessmentId) {
          return;
        }
        state.stepProgressLoading = false;
        state.stepProgress = action.payload;
        state.stepProgressError = null;
      })
      .addCase(getStepProgressAction.rejected, (state, action) => {
        if (action.meta.arg !== state.stepProgressAssessmentId) {
          return;
        }
        state.stepProgressLoading = false;
        state.stepProgressError = action.payload;
        state.stepProgress = null;
      });

    // Get Dashboard Data
    builder
      .addCase(getDashboardDataAction.pending, (state) => {
        state.getDashboardLoading = true;
        state.getDashboardError = null;
      })
      .addCase(getDashboardDataAction.fulfilled, (state, action) => {
        state.getDashboardLoading = false;
        state.getDashboardData = action.payload;
        state.getDashboardError = null;
      })
      // The dashboard has no local mirror, so a failed refresh keeps the last
      // values on screen instead of blanking the cards while offline.
      .addCase(getDashboardDataAction.rejected, (state, action) => {
        state.getDashboardLoading = false;
        state.getDashboardError = action.payload;
      });
  }
});

export const {
  resetAllAssessmentsState,
  resetAssessmentByIdState,
  resetAllAttendanceState,
  resetAttendanceStatusState,
  resetPunchInState,
  resetPunchOutState,
  resetAssessmentParametersState,
  resetStepProgressState,
  clearRescheduledFlag,
  resetAssessmentState
} = assessmentSlice.actions;

export default assessmentSlice.reducer;
