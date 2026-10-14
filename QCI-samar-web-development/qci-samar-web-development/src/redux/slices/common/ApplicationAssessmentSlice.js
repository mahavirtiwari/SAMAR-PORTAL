import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import {
  addMeetingParticipantAction,
  bulkAssignParametersAction,
  completeFieldWorkAction,
  createMeetingAction,
  deleteResponseEvidenceAction,
  getAllStepDataAction,
  getAttendanceAction,
  getBasicInformationAction,
  getClosingMeetingAction,
  getFieldCompletionStatusAction,
  getMyAssignmentsAction,
  getMyPunchStatusAction,
  getOpeningMeetingAction,
  getParametersAction,
  getResponseByQuestionAction,
  getResponseEvidencesAction,
  getResponsesAction,
  getSitePicturesAction,
  getSiteTourPicturesAction,
  getStepProgressAction,
  punchInAction,
  punchOutAction,
  removeMeetingParticipantAction,
  saveBasicInformationAction,
  submitResponseAction,
  updateMeetingCommentsAction,
  updateResponseByQuestionAction,
  uploadResponseEvidenceAction,
} from '../../action/common/ApplicationAssessmentAction';

// Background refreshes (useLiveRefresh) pass { silent: true }: they keep the
// current content on screen, ignore transient errors, and only replace the data
// when it actually changed, so images are not re-fetched on every tick.
const isSilent = action => !!action.meta?.arg?.silent;
const sameData = (current, next) => {
  try {
    return JSON.stringify(current) === JSON.stringify(next);
  } catch {
    return false;
  }
};

const initialState = {
  // Step Progress
  stepProgress: null,
  stepProgressLoading: false,
  stepProgressError: null,

  // Step 1: Parameters
  parameters: [],
  parametersLoading: false,
  parametersError: null,

  meetingComments: [],
  meetingCommentsLoading: false,
  meetingCommentsError: null,

  // Step 2: Site Pictures
  sitePictures: [],
  sitePicturesLoading: false,
  sitePicturesError: null,

  // Step 3: Opening Meeting
  openingMeeting: null,
  openingMeetingPendingComments: [],
  openingMeetingLoading: false,
  openingMeetingError: null,

  // Step 4: Site Tour Pictures
  siteTourPictures: [],
  siteTourPicturesLoading: false,
  siteTourPicturesError: null,

  // Step 5: Basic Information
  basicInformation: null,
  basicInformationLoading: false,
  basicInformationError: null,

  // Step 6: Responses
  responses: null,
  responsesLoading: true,
  responsesError: null,

  currentResponse: null,
  currentResponseLoading: false,
  currentResponseError: null,

  // Committee Feedback & Review - submit response
  submitResponseLoading: false,
  submitResponseError: null,
  submitResponseResult: null,
  responseEvidences: [],
  responseEvidencesLoading: false,
  responseEvidencesError: null,

  // Update response by question
  updateResponseByQuestionLoading: false,
  updateResponseByQuestionError: null,
  updateResponseByQuestionResult: null,

  // Step 7: Closing Meeting
  closingMeeting: null,
  closingMeetingPendingComments: [],
  closingMeetingLoading: false,
  closingMeetingError: null,

  // Attendance
  attendance: [],
  attendanceLoading: false,
  attendanceError: null,

  // All Step Data (convenience)
  allStepDataLoading: false,
  allStepDataError: null,

  // ── Execution: Parameter Allocation ──
  myAssignments: null,
  myAssignmentsLoading: false,
  myAssignmentsError: null,
  bulkAssignLoading: false,
  bulkAssignError: null,
  bulkAssignResult: null,

  // ── Execution: Attendance (Punch In/Out) ──
  punchStatus: null,
  punchStatusLoading: false,
  punchStatusError: null,
  punchActionLoading: false,
  punchActionError: null,
  punchActionResult: null,

  // ── Execution: Meetings ──
  meetingActionLoading: false,
  meetingActionError: null,
  meetingActionResult: null,

  // ── Execution: Basic Information ──
  saveBasicInformationLoading: false,
  saveBasicInformationError: null,
  saveBasicInformationResult: null,

  // ── Execution: Response Evidences ──
  evidenceActionLoading: false,
  evidenceActionError: null,

  // ── Execution: Field-work completion ──
  fieldCompletionStatus: null,
  fieldCompletionStatusLoading: false,
  fieldCompletionStatusError: null,
  completeFieldWorkLoading: false,
  completeFieldWorkError: null,
  completeFieldWorkResult: null,
};

const applicationAssessmentSlice = createSlice({
  name: 'applicationAssessment',
  initialState,
  reducers: {
    resetApplicationAssessment() {
      return initialState;
    },
    resetApplicationAssessmentErrors(state) {
      state.stepProgressError = null;
      state.stepProgressDetailsError = null;
      state.parametersError = null;
      state.meetingCommentsError = null;
      state.sitePicturesError = null;
      state.openingMeetingError = null;
      state.siteTourPicturesError = null;
      state.basicInformationError = null;
      state.responsesError = null;
      state.currentResponseError = null;
      state.responseEvidencesError = null;
      state.closingMeetingError = null;
      state.attendanceError = null;
      state.allStepDataError = null;
    },
    clearParameterComments(state) {
      state.meetingComments = [];
      state.meetingCommentsError = null;
    },
    clearResponseEvidences(state) {
      state.responseEvidences = [];
      state.responseEvidencesError = null;
    },
  },
  extraReducers: builder => {
    // ============================================
    // Step Progress
    // ============================================
    builder
      .addCase(getStepProgressAction.pending, state => {
        state.stepProgressLoading = true;
        state.stepProgressError = null;
      })
      .addCase(getStepProgressAction.fulfilled, (state, action) => {
        state.stepProgressLoading = false;
        state.stepProgress = action.payload || null;
        Logger.info('Step progress loaded successfully in slice');
      })
      .addCase(getStepProgressAction.rejected, (state, action) => {
        state.stepProgressLoading = false;
        state.stepProgressError = action.payload;
        Logger.error('Get step progress failed in slice:', action.payload);
      });

    // ============================================
    // Step 1: Parameters
    // ============================================
    builder
      .addCase(getParametersAction.pending, state => {
        state.parametersLoading = true;
        state.parametersError = null;
      })
      .addCase(getParametersAction.fulfilled, (state, action) => {
        state.parametersLoading = false;
        state.parameters = action.payload?.data?.parameters || action.payload?.data || action.payload || [];
        Logger.info('Parameters loaded successfully in slice');
      })
      .addCase(getParametersAction.rejected, (state, action) => {
        state.parametersLoading = false;
        state.parametersError = action.payload;
        Logger.error('Get parameters failed in slice:', action.payload);
      });

    builder
      .addCase(updateMeetingCommentsAction.pending, state => {
        state.meetingCommentsLoading = true;
        state.meetingCommentsError = null;
      })
      .addCase(updateMeetingCommentsAction.fulfilled, (state, action) => {
        state.meetingCommentsLoading = false;
        state.meetingComments = action.payload?.data?.comments || action.payload?.data || action.payload || [];
        Logger.info('Parameter comments loaded successfully in slice');
      })
      .addCase(updateMeetingCommentsAction.rejected, (state, action) => {
        state.meetingCommentsLoading = false;
        state.meetingCommentsError = action.payload;
        Logger.error('Get parameter comments failed in slice:', action.payload);
      });

    // ============================================
    // Step 2: Site Pictures
    // ============================================
    builder
      .addCase(getSitePicturesAction.pending, (state, action) => {
        if (isSilent(action)) {
          return;
        }
        state.sitePicturesLoading = true;
        state.sitePicturesError = null;
      })
      .addCase(getSitePicturesAction.fulfilled, (state, action) => {
        state.sitePicturesLoading = false;
        const next = action.payload?.data?.sitePictures || action.payload?.data || action.payload || [];
        if (!(isSilent(action) && sameData(state.sitePictures, next))) {
          state.sitePictures = next;
        }
        Logger.info('Site pictures loaded successfully in slice');
      })
      .addCase(getSitePicturesAction.rejected, (state, action) => {
        state.sitePicturesLoading = false;
        if (isSilent(action)) {
          return;
        }
        state.sitePicturesError = action.payload;
        Logger.error('Get site pictures failed in slice:', action.payload);
      });

    // ============================================
    // Step 3: Opening Meeting
    // ============================================
    builder
      .addCase(getOpeningMeetingAction.pending, (state, action) => {
        if (isSilent(action)) {
          return;
        }
        state.openingMeetingLoading = true;
        state.openingMeetingError = null;
      })
      .addCase(getOpeningMeetingAction.fulfilled, (state, action) => {
        state.openingMeetingLoading = false;
        const next = action.payload?.data?.meeting || action.payload?.data || action.payload || null;
        if (!(isSilent(action) && sameData(state.openingMeeting, next))) {
          state.openingMeeting = next;
        }
        const pending = action.payload?.data?.pendingCommentsFrom || [];
        if (!sameData(state.openingMeetingPendingComments, pending)) {
          state.openingMeetingPendingComments = pending;
        }
        Logger.info('Opening meeting loaded successfully in slice');
      })
      .addCase(getOpeningMeetingAction.rejected, (state, action) => {
        state.openingMeetingLoading = false;
        if (isSilent(action)) {
          return;
        }
        state.openingMeetingError = action.payload;
        Logger.error('Get opening meeting failed in slice:', action.payload);
      });

    // ============================================
    // Step 4: Site Tour Pictures
    // ============================================
    builder
      .addCase(getSiteTourPicturesAction.pending, (state, action) => {
        if (isSilent(action)) {
          return;
        }
        state.siteTourPicturesLoading = true;
        state.siteTourPicturesError = null;
      })
      .addCase(getSiteTourPicturesAction.fulfilled, (state, action) => {
        state.siteTourPicturesLoading = false;
        const next = action.payload?.data?.siteTourPictures || action.payload?.data || action.payload || [];
        if (!(isSilent(action) && sameData(state.siteTourPictures, next))) {
          state.siteTourPictures = next;
        }
        Logger.info('Site tour pictures loaded successfully in slice');
      })
      .addCase(getSiteTourPicturesAction.rejected, (state, action) => {
        state.siteTourPicturesLoading = false;
        if (isSilent(action)) {
          return;
        }
        state.siteTourPicturesError = action.payload;
        Logger.error('Get site tour pictures failed in slice:', action.payload);
      });

    // ============================================
    // Step 5: Basic Information
    // ============================================
    builder
      .addCase(getBasicInformationAction.pending, state => {
        state.basicInformationLoading = true;
        state.basicInformationError = null;
      })
      .addCase(getBasicInformationAction.fulfilled, (state, action) => {
        state.basicInformationLoading = false;
        state.basicInformation = action.payload?.data?.basicInformation || action.payload?.data || action.payload || null;
        Logger.info('Basic information loaded successfully in slice');
      })
      .addCase(getBasicInformationAction.rejected, (state, action) => {
        state.basicInformationLoading = false;
        state.basicInformationError = action.payload;
        Logger.error('Get basic information failed in slice:', action.payload);
      });

    // ============================================
    // Step 6: Responses
    // ============================================
    builder
      .addCase(getResponsesAction.pending, state => {
        state.responsesLoading = true;
        state.responsesError = null;
      })
      .addCase(getResponsesAction.fulfilled, (state, action) => {
        state.responsesLoading = false;
        state.responses = action.payload?.data || [];
        Logger.info('Responses loaded successfully in slice', action.payload?.data);
      })
      .addCase(getResponsesAction.rejected, (state, action) => {
        state.responsesLoading = false;
        state.responsesError = action.payload;
        Logger.error('Get responses failed in slice:', action.payload);
      });

    builder
      .addCase(getResponseByQuestionAction.pending, state => {
        state.currentResponseLoading = true;
        state.currentResponseError = null;
      })
      .addCase(getResponseByQuestionAction.fulfilled, (state, action) => {
        state.currentResponseLoading = false;
        state.currentResponse = action.payload?.data?.response || action.payload?.data || action.payload || null;
        Logger.info('Response loaded successfully in slice');
      })
      .addCase(getResponseByQuestionAction.rejected, (state, action) => {
        state.currentResponseLoading = false;
        state.currentResponseError = action.payload;
        Logger.error('Get response failed in slice:', action.payload);
      });

    builder
      .addCase(getResponseEvidencesAction.pending, state => {
        state.responseEvidencesLoading = true;
        state.responseEvidencesError = null;
      })
      .addCase(getResponseEvidencesAction.fulfilled, (state, action) => {
        state.responseEvidencesLoading = false;
        state.responseEvidences = action.payload?.data?.evidences || action.payload?.data || action.payload || [];
        Logger.info('Response evidences loaded successfully in slice');
      })
      .addCase(getResponseEvidencesAction.rejected, (state, action) => {
        state.responseEvidencesLoading = false;
        state.responseEvidencesError = action.payload;
        Logger.error('Get response evidences failed in slice:', action.payload);
      });

    // ============================================
    // Committee Feedback & Review - Submit Response
    // ============================================
    builder
      .addCase(submitResponseAction.pending, state => {
        state.submitResponseLoading = true;
        state.submitResponseError = null;
      })
      .addCase(submitResponseAction.fulfilled, (state, action) => {
        state.submitResponseLoading = false;
        state.submitResponseResult = action.payload?.data || action.payload || null;
        Logger.info('Submit response completed successfully in slice');
      })
      .addCase(submitResponseAction.rejected, (state, action) => {
        state.submitResponseLoading = false;
        state.submitResponseError = action.payload;
        Logger.error('Submit response failed in slice:', action.payload);
      });

    builder
      .addCase(updateResponseByQuestionAction.pending, state => {
        state.updateResponseByQuestionLoading = true;
        state.updateResponseByQuestionError = null;
      })
      .addCase(updateResponseByQuestionAction.fulfilled, (state, action) => {
        state.updateResponseByQuestionLoading = false;
        state.updateResponseByQuestionResult = action.payload?.data || action.payload || null;

        // Try to merge updated response into state.responses.parameters if possible
        const questionId = action?.meta?.arg?.questionId;
        const updatedResp = action.payload?.data?.response || action.payload?.response || action.payload?.data || action.payload;
        if (questionId && state.responses && Array.isArray(state.responses.parameters)) {
          for (const param of state.responses.parameters) {
            if (Array.isArray(param.questions)) {
              for (const q of param.questions) {
                if (`${q.id}` === `${questionId}` || `${q.questionId}` === `${questionId}`) {
                  // Merge to avoid dropping nested fields like evidences
                  q.response = { ...(q.response || {}), ...(updatedResp || {}) };
                  break;
                }
              }
            }
          }
        }
        // Also merge into top-level responses.questions if present (array or object)
        if (questionId && state.responses && state.responses.questions) {
          const topQuestions = state.responses.questions;
          if (Array.isArray(topQuestions)) {
            for (const q of topQuestions) {
              if (`${q.id}` === `${questionId}` || `${q.questionId}` === `${questionId}`) {
                q.response = { ...(q.response || {}), ...(updatedResp || {}) };
                break;
              }
            }
          } else if (topQuestions && typeof topQuestions === 'object') {
            for (const k of Object.keys(topQuestions)) {
              const q = topQuestions[k];
              if (q && (`${q.id}` === `${questionId}` || `${q.questionId}` === `${questionId}`)) {
                q.response = { ...(q.response || {}), ...(updatedResp || {}) };
                break;
              }
            }
          }
        }

        Logger.info('Update response by question completed successfully in slice');
      })
      .addCase(updateResponseByQuestionAction.rejected, (state, action) => {
        state.updateResponseByQuestionLoading = false;
        state.updateResponseByQuestionError = action.payload;
        Logger.error('Update response by question failed in slice:', action.payload);
      });

    // ============================================
    // Step 7: Closing Meeting
    // ============================================
    builder
      .addCase(getClosingMeetingAction.pending, (state, action) => {
        if (isSilent(action)) {
          return;
        }
        state.closingMeetingLoading = true;
        state.closingMeetingError = null;
      })
      .addCase(getClosingMeetingAction.fulfilled, (state, action) => {
        state.closingMeetingLoading = false;
        const next = action.payload?.data?.meeting || action.payload?.data || action.payload || null;
        if (!(isSilent(action) && sameData(state.closingMeeting, next))) {
          state.closingMeeting = next;
        }
        const pending = action.payload?.data?.pendingCommentsFrom || [];
        if (!sameData(state.closingMeetingPendingComments, pending)) {
          state.closingMeetingPendingComments = pending;
        }
        Logger.info('Closing meeting loaded successfully in slice');
      })
      .addCase(getClosingMeetingAction.rejected, (state, action) => {
        state.closingMeetingLoading = false;
        if (isSilent(action)) {
          return;
        }
        state.closingMeetingError = action.payload;
        Logger.error('Get closing meeting failed in slice:', action.payload);
      });

    // ============================================
    // Attendance
    // ============================================
    builder
      .addCase(getAttendanceAction.pending, (state, action) => {
        if (isSilent(action)) {
          return;
        }
        state.attendanceLoading = true;
        state.attendanceError = null;
      })
      .addCase(getAttendanceAction.fulfilled, (state, action) => {
        state.attendanceLoading = false;
        const next = action.payload?.data?.attendance || action.payload?.data || action.payload || [];
        if (!(isSilent(action) && sameData(state.attendance, next))) {
          state.attendance = next;
        }
        Logger.info('Attendance loaded successfully in slice');
      })
      .addCase(getAttendanceAction.rejected, (state, action) => {
        state.attendanceLoading = false;
        if (isSilent(action)) {
          return;
        }
        state.attendanceError = action.payload;
        Logger.error('Get attendance failed in slice:', action.payload);
      });

    // ============================================
    // Execution: Parameter Allocation (Lead)
    // ============================================
    builder
      .addCase(getMyAssignmentsAction.pending, state => {
        state.myAssignmentsLoading = true;
        state.myAssignmentsError = null;
      })
      .addCase(getMyAssignmentsAction.fulfilled, (state, action) => {
        state.myAssignmentsLoading = false;
        state.myAssignments = action.payload?.data ?? action.payload ?? null;
      })
      .addCase(getMyAssignmentsAction.rejected, (state, action) => {
        state.myAssignmentsLoading = false;
        state.myAssignmentsError = action.payload;
      });

    builder
      .addCase(bulkAssignParametersAction.pending, state => {
        state.bulkAssignLoading = true;
        state.bulkAssignError = null;
      })
      .addCase(bulkAssignParametersAction.fulfilled, (state, action) => {
        state.bulkAssignLoading = false;
        state.bulkAssignResult = action.payload?.data ?? action.payload ?? null;
      })
      .addCase(bulkAssignParametersAction.rejected, (state, action) => {
        state.bulkAssignLoading = false;
        state.bulkAssignError = action.payload;
      });

    // ============================================
    // Execution: Attendance (Punch In/Out)
    // ============================================
    builder
      .addCase(getMyPunchStatusAction.pending, state => {
        state.punchStatusLoading = true;
        state.punchStatusError = null;
      })
      .addCase(getMyPunchStatusAction.fulfilled, (state, action) => {
        state.punchStatusLoading = false;
        state.punchStatus = action.payload?.data ?? action.payload ?? null;
      })
      .addCase(getMyPunchStatusAction.rejected, (state, action) => {
        state.punchStatusLoading = false;
        state.punchStatusError = action.payload;
      });

    // ============================================
    // Execution: Basic Information (Lead)
    // ============================================
    builder
      .addCase(saveBasicInformationAction.pending, state => {
        state.saveBasicInformationLoading = true;
        state.saveBasicInformationError = null;
      })
      .addCase(saveBasicInformationAction.fulfilled, (state, action) => {
        state.saveBasicInformationLoading = false;
        state.saveBasicInformationResult = action.payload?.data ?? action.payload ?? null;
      })
      .addCase(saveBasicInformationAction.rejected, (state, action) => {
        state.saveBasicInformationLoading = false;
        state.saveBasicInformationError = action.payload;
      });

    // ============================================
    // Execution: Field-work completion (Lead + Co)
    // ============================================
    builder
      .addCase(getFieldCompletionStatusAction.pending, state => {
        state.fieldCompletionStatusLoading = true;
        state.fieldCompletionStatusError = null;
      })
      .addCase(getFieldCompletionStatusAction.fulfilled, (state, action) => {
        state.fieldCompletionStatusLoading = false;
        state.fieldCompletionStatus = action.payload?.data ?? action.payload ?? null;
      })
      .addCase(getFieldCompletionStatusAction.rejected, (state, action) => {
        state.fieldCompletionStatusLoading = false;
        state.fieldCompletionStatusError = action.payload;
      });

    builder
      .addCase(completeFieldWorkAction.pending, state => {
        state.completeFieldWorkLoading = true;
        state.completeFieldWorkError = null;
      })
      .addCase(completeFieldWorkAction.fulfilled, (state, action) => {
        state.completeFieldWorkLoading = false;
        state.completeFieldWorkResult = action.payload?.data ?? action.payload ?? null;
      })
      .addCase(completeFieldWorkAction.rejected, (state, action) => {
        state.completeFieldWorkLoading = false;
        state.completeFieldWorkError = action.payload;
      });

    // ============================================
    // All Step Data (convenience action)
    // ============================================
    builder
      .addCase(getAllStepDataAction.pending, state => {
        state.allStepDataLoading = true;
        state.allStepDataError = null;
      })
      .addCase(getAllStepDataAction.fulfilled, (state, action) => {
        state.allStepDataLoading = false;
        const data = action.payload || {};

        // Populate all step data from the combined response
        if (data.stepProgress) {
          state.stepProgress = data.stepProgress?.data || data.stepProgress;
        }
        if (data.parameters) {
          state.parameters = data.parameters?.data?.parameters || data.parameters?.data || data.parameters || [];
        }
        if (data.sitePictures) {
          state.sitePictures = data.sitePictures?.data?.sitePictures || data.sitePictures?.data || data.sitePictures || [];
        }
        if (data.openingMeeting) {
          state.openingMeeting = data.openingMeeting?.data?.meeting || data.openingMeeting?.data || data.openingMeeting;
        }
        if (data.siteTourPictures) {
          state.siteTourPictures = data.siteTourPictures?.data?.siteTourPictures || data.siteTourPictures?.data || data.siteTourPictures || [];
        }
        if (data.basicInformation) {
          state.basicInformation = data.basicInformation?.data?.basicInformation || data.basicInformation?.data || data.basicInformation;
        }
        if (data.responses) {
          state.responses = data.responses?.data?.responses || data.responses?.data || data.responses || [];
        }
        if (data.closingMeeting) {
          state.closingMeeting = data.closingMeeting?.data?.meeting || data.closingMeeting?.data || data.closingMeeting;
        }
        if (data.attendance) {
          state.attendance = data.attendance?.data?.attendance || data.attendance?.data || data.attendance || [];
        }

        Logger.info('All step data loaded successfully in slice');
      })
      .addCase(getAllStepDataAction.rejected, (state, action) => {
        state.allStepDataLoading = false;
        state.allStepDataError = action.payload;
        Logger.error('Get all step data failed in slice:', action.payload);
      });

    // ============================================
    // Execution: Attendance (Punch In/Out)
    // ============================================
    builder
      .addMatcher(
        action => [punchInAction.pending.type, punchOutAction.pending.type].includes(action.type),
        state => {
          state.punchActionLoading = true;
          state.punchActionError = null;
        },
      )
      .addMatcher(
        action => [punchInAction.fulfilled.type, punchOutAction.fulfilled.type].includes(action.type),
        (state, action) => {
          state.punchActionLoading = false;
          state.punchActionResult = action.payload?.data ?? action.payload ?? null;
        },
      )
      .addMatcher(
        action => [punchInAction.rejected.type, punchOutAction.rejected.type].includes(action.type),
        (state, action) => {
          state.punchActionLoading = false;
          state.punchActionError = action.payload;
        },
      );

    // ============================================
    // Execution: Meetings (create + participants)
    // ============================================
    builder
      .addMatcher(
        action => [createMeetingAction.pending.type, addMeetingParticipantAction.pending.type, removeMeetingParticipantAction.pending.type].includes(action.type),
        state => {
          state.meetingActionLoading = true;
          state.meetingActionError = null;
        },
      )
      .addMatcher(
        action => [createMeetingAction.fulfilled.type, addMeetingParticipantAction.fulfilled.type, removeMeetingParticipantAction.fulfilled.type].includes(action.type),
        (state, action) => {
          state.meetingActionLoading = false;
          state.meetingActionResult = action.payload?.data ?? action.payload ?? null;
        },
      )
      .addMatcher(
        action => [createMeetingAction.rejected.type, addMeetingParticipantAction.rejected.type, removeMeetingParticipantAction.rejected.type].includes(action.type),
        (state, action) => {
          state.meetingActionLoading = false;
          state.meetingActionError = action.payload;
        },
      );

    // ============================================
    // Execution: Response Evidences (Lead + Co)
    // ============================================
    builder
      .addMatcher(
        action => [uploadResponseEvidenceAction.pending.type, deleteResponseEvidenceAction.pending.type].includes(action.type),
        state => {
          state.evidenceActionLoading = true;
          state.evidenceActionError = null;
        },
      )
      .addMatcher(
        action => [uploadResponseEvidenceAction.fulfilled.type, deleteResponseEvidenceAction.fulfilled.type].includes(action.type),
        state => {
          state.evidenceActionLoading = false;
        },
      )
      .addMatcher(
        action => [uploadResponseEvidenceAction.rejected.type, deleteResponseEvidenceAction.rejected.type].includes(action.type),
        (state, action) => {
          state.evidenceActionLoading = false;
          state.evidenceActionError = action.payload;
        },
      );
  },
});

export const { resetApplicationAssessment, resetApplicationAssessmentErrors, clearParameterComments, clearResponseEvidences } = applicationAssessmentSlice.actions;

export default applicationAssessmentSlice.reducer;
