import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import {
  coAssessorSubmitAction,
  committeeDecisionAction,
  downloadAssessmentReportAction,
  downloadCertificateAction,
  getAssessmentByIdAction,
  getAssessmentQuestionByIdAction,
  getAssessmentQuestionsAction,
  getAssessmentsAction,
  getAssessorsAction,
  getAvailableTransitionsAction,
  postQuestionClarificationAction,
  qcDecisionAction,
  resubmitForQcAction,
  resubmitToCommitteeAction,
  scheduleAssessmentAction,
  scheduleCommitteeAction,
  submitAssessmentForQcAction,
  updateQuestionClarificationAction,
} from '../../action/common/AssessmentAction';

const initialState = {
  assessments: [],
  assessmentsPagination: null,
  assessmentsLoading: false,
  assessmentsError: null,

  assessment: null,
  assessmentLoading: false,
  assessmentError: null,

  assessmentQuestions: [],
  assessmentQuestionsLoading: false,
  assessmentQuestionsError: null,

  assessmentQuestion: null,
  assessmentQuestionLoading: false,
  assessmentQuestionError: null,

  // Assessors list
  assessors: [],
  assessorsLoading: false,
  assessorsError: null,

  // Schedule assessment
  scheduleLoading: false,
  scheduleError: null,
  scheduledAssessment: null,

  // QC Decision
  qcDecisionLoading: false,
  qcDecisionError: null,
  qcDecisionResult: null,

  // Resubmit for QC
  resubmitForQcLoading: false,
  resubmitForQcError: null,
  resubmitForQcResult: null,

  // Schedule committee
  scheduleCommitteeLoading: false,
  scheduleCommitteeError: null,
  scheduleCommitteeResult: null,

  // Resubmit to committee
  resubmitToCommitteeLoading: false,
  resubmitToCommitteeError: null,
  resubmitToCommitteeResult: null,

  // Available transitions
  availableTransitions: null,
  availableTransitionsLoading: false,
  availableTransitionsError: null,

  // Post question clarification (Assessor)
  postClarificationLoading: false,
  postClarificationError: null,
  postClarificationResult: null,

  submitAssessmentForQcLoading: false,
  submitAssessmentForQcError: null,
  submitAssessmentForQcResult: null,

  // Co-assessor web submit
  coAssessorSubmitLoading: false,
  coAssessorSubmitError: null,
  coAssessorSubmitResult: null,

  // Committee decision (certify / provide feedback)
  committeeDecisionLoading: false,
  committeeDecisionError: null,
  committeeDecisionResult: null,

  // Execute transition
  transitionLoading: false,
  transitionError: null,
  transitionResult: null,
  // Pending QC actions collected from modals before final submit
  pendingQcActions: [],
  // Pending RC scores collected during review, submitted in batch with committee decision
  pendingRcScores: [],

  updateClarificationLoading: false,
  updateClarificationError: null,
  updateClarificationResult: null,
};

const assessmentSlice = createSlice({
  name: 'assessment',
  initialState,
  reducers: {
    // Add or update a pending QC action for later submission
    addPendingQc(state, action) {
      const item = action.payload;
      if (!item || !item.assessmentId) {
        return;
      }
      // ensure uniqueness by questionId when present
      const existingIndex = state.pendingQcActions.findIndex(p => p.assessmentId === item.assessmentId && p.questionId === item.questionId);
      if (existingIndex >= 0) {
        state.pendingQcActions[existingIndex] = { ...state.pendingQcActions[existingIndex], ...item };
      } else {
        state.pendingQcActions.push(item);
      }
    },
    removePendingQc(state, action) {
      const { assessmentId, questionId } = action.payload || {};
      state.pendingQcActions = state.pendingQcActions.filter(p => !(p.assessmentId === assessmentId && p.questionId === questionId));
    },
    clearPendingQc(state, action) {
      const assessmentId = action.payload;
      if (assessmentId) {
        state.pendingQcActions = state.pendingQcActions.filter(p => p.assessmentId !== assessmentId);
      } else {
        state.pendingQcActions = [];
      }
    },
    addPendingRcScore(state, action) {
      const item = action.payload;
      if (!item || !item.assessmentId) {
        return;
      }
      const existingIndex = state.pendingRcScores.findIndex(p => p.assessmentId === item.assessmentId && p.questionId === item.questionId);
      if (existingIndex >= 0) {
        state.pendingRcScores[existingIndex] = { ...state.pendingRcScores[existingIndex], ...item };
      } else {
        state.pendingRcScores.push(item);
      }
    },
    removePendingRcScore(state, action) {
      const { assessmentId, questionId } = action.payload || {};
      state.pendingRcScores = state.pendingRcScores.filter(p => !(p.assessmentId === assessmentId && p.questionId === questionId));
    },
    clearPendingRcScores(state, action) {
      const assessmentId = action.payload;
      if (assessmentId) {
        state.pendingRcScores = state.pendingRcScores.filter(p => p.assessmentId !== assessmentId);
      } else {
        state.pendingRcScores = [];
      }
    },
    resetAssessmentState(state) {
      state.scheduleLoading = false;
      state.scheduleError = null;
      state.scheduledAssessment = null;
      state.qcDecisionLoading = false;
      state.qcDecisionError = null;
      state.qcDecisionResult = null;
      state.resubmitForQcLoading = false;
      state.resubmitForQcError = null;
      state.resubmitForQcResult = null;
      state.scheduleCommitteeLoading = false;
      state.scheduleCommitteeError = null;
      state.scheduleCommitteeResult = null;
      state.resubmitToCommitteeLoading = false;
      state.resubmitToCommitteeError = null;
      state.resubmitToCommitteeResult = null;
      state.committeeDecisionLoading = false;
      state.committeeDecisionError = null;
      state.committeeDecisionResult = null;
      state.transitionLoading = false;
      state.transitionError = null;
      state.transitionResult = null;
    },
    resetAssessmentErrors(state) {
      state.assessmentsError = null;
      state.assessmentError = null;
      state.assessmentQuestionsError = null;
      state.assessmentQuestionError = null;
    },

    resetAssessmentForQcErrors(state) {
      state.submitAssessmentForQcError = null;
      state.submitAssessmentForQcResult = null;
      state.submitAssessmentForQcLoading = null;
    },

    resetCoAssessorSubmit(state) {
      state.coAssessorSubmitError = null;
      state.coAssessorSubmitResult = null;
      state.coAssessorSubmitLoading = false;
    },
  },
  extraReducers: builder => {
    // Get all assessments
    builder
      .addCase(getAssessmentsAction.pending, state => {
        state.assessmentsLoading = true;
        state.assessmentsError = null;
      })
      .addCase(getAssessmentsAction.fulfilled, (state, action) => {
        state.assessmentsLoading = false;
        // Handle paginated response: { data: { assessments: [...], pagination: {...} } }
        state.assessments = action.payload?.data || [];
        state.assessmentsPagination = action.payload?.data?.pagination || action.payload?.pagination || null;
        Logger.info('Assessments loaded successfully in slice');
      })
      .addCase(getAssessmentsAction.rejected, (state, action) => {
        state.assessmentsLoading = false;
        state.assessmentsError = action.payload;
        Logger.error('Get assessments failed in slice:', action.payload);
      });

    // Get assessment by ID
    builder
      .addCase(getAssessmentByIdAction.pending, state => {
        state.assessmentLoading = true;
        state.assessmentError = null;
      })
      .addCase(getAssessmentByIdAction.fulfilled, (state, action) => {
        state.assessmentLoading = false;
        state.assessment = action.payload || null;
        Logger.info('Assessment loaded successfully in slice');
      })
      .addCase(getAssessmentByIdAction.rejected, (state, action) => {
        state.assessmentLoading = false;
        state.assessmentError = action.payload;
        Logger.error('Get assessment failed in slice:', action.payload);
      });

    // Get all assessment questions
    builder
      .addCase(getAssessmentQuestionsAction.pending, state => {
        state.assessmentQuestionsLoading = true;
        state.assessmentQuestionsError = null;
      })
      .addCase(getAssessmentQuestionsAction.fulfilled, (state, action) => {
        state.assessmentQuestionsLoading = false;
        state.assessmentQuestions = action.payload || [];
        Logger.info('Assessment questions loaded successfully in slice');
      })
      .addCase(getAssessmentQuestionsAction.rejected, (state, action) => {
        state.assessmentQuestionsLoading = false;
        state.assessmentQuestionsError = action.payload;
        Logger.error('Get assessment questions failed in slice:', action.payload);
      });

    // Get assessment question by ID
    builder
      .addCase(getAssessmentQuestionByIdAction.pending, state => {
        state.assessmentQuestionLoading = true;
        state.assessmentQuestionError = null;
      })
      .addCase(getAssessmentQuestionByIdAction.fulfilled, (state, action) => {
        state.assessmentQuestionLoading = false;
        state.assessmentQuestion = action.payload || null;
        Logger.info('Assessment question loaded successfully in slice');
      })
      .addCase(getAssessmentQuestionByIdAction.rejected, (state, action) => {
        state.assessmentQuestionLoading = false;
        state.assessmentQuestionError = action.payload;
        Logger.error('Get assessment question failed in slice:', action.payload);
      });

    // Get assessors list
    builder
      .addCase(getAssessorsAction.pending, state => {
        state.assessorsLoading = true;
        state.assessorsError = null;
      })
      .addCase(getAssessorsAction.fulfilled, (state, action) => {
        state.assessorsLoading = false;
        // Handle paginated response: { data: { users: [...] } }
        state.assessors = action.payload?.data?.users || action.payload?.users || action.payload?.data || [];
        Logger.info('Assessors loaded successfully in slice');
      })
      .addCase(getAssessorsAction.rejected, (state, action) => {
        state.assessorsLoading = false;
        state.assessorsError = action.payload;
        Logger.error('Get assessors failed in slice:', action.payload);
      });

    // Schedule assessment
    builder
      .addCase(scheduleAssessmentAction.pending, state => {
        state.scheduleLoading = true;
        state.scheduleError = null;
      })
      .addCase(scheduleAssessmentAction.fulfilled, (state, action) => {
        state.scheduleLoading = false;
        state.scheduledAssessment = action.payload?.data || action.payload || null;
        Logger.info('Assessment scheduled successfully in slice');
      })
      .addCase(scheduleAssessmentAction.rejected, (state, action) => {
        state.scheduleLoading = false;
        state.scheduleError = action.payload;
        Logger.error('Schedule assessment failed in slice:', action.payload);
      });

    // QC Decision
    builder
      .addCase(qcDecisionAction.pending, state => {
        state.qcDecisionLoading = true;
        state.qcDecisionError = null;
      })
      .addCase(qcDecisionAction.fulfilled, (state, action) => {
        state.qcDecisionLoading = false;
        state.qcDecisionResult = action.payload?.data || action.payload || null;
        Logger.info('QC Decision completed successfully in slice');
      })
      .addCase(qcDecisionAction.rejected, (state, action) => {
        state.qcDecisionLoading = false;
        state.qcDecisionError = action.payload;
        Logger.error('QC Decision failed in slice:', action.payload);
      });

    // Resubmit for QC
    builder
      .addCase(resubmitForQcAction.pending, state => {
        state.resubmitForQcLoading = true;
        state.resubmitForQcError = null;
      })
      .addCase(resubmitForQcAction.fulfilled, (state, action) => {
        state.resubmitForQcLoading = false;
        state.resubmitForQcResult = action.payload?.data || action.payload || null;
        Logger.info('Resubmit for QC completed successfully in slice');
      })
      .addCase(resubmitForQcAction.rejected, (state, action) => {
        state.resubmitForQcLoading = false;
        state.resubmitForQcError = action.payload;
        Logger.error('Resubmit for QC failed in slice:', action.payload);
      });

    // Schedule committee
    builder
      .addCase(scheduleCommitteeAction.pending, state => {
        state.scheduleCommitteeLoading = true;
        state.scheduleCommitteeError = null;
      })
      .addCase(scheduleCommitteeAction.fulfilled, (state, action) => {
        state.scheduleCommitteeLoading = false;
        state.scheduleCommitteeResult = action.payload?.data || action.payload || null;
        Logger.info('Schedule committee completed successfully in slice');
      })
      .addCase(scheduleCommitteeAction.rejected, (state, action) => {
        state.scheduleCommitteeLoading = false;
        state.scheduleCommitteeError = action.payload;
        Logger.error('Schedule committee failed in slice:', action.payload);
      });

    // Resubmit to committee
    builder
      .addCase(resubmitToCommitteeAction.pending, state => {
        state.resubmitToCommitteeLoading = true;
        state.resubmitToCommitteeError = null;
      })
      .addCase(resubmitToCommitteeAction.fulfilled, (state, action) => {
        state.resubmitToCommitteeLoading = false;
        state.resubmitToCommitteeResult = action.payload?.data || action.payload || null;
        Logger.info('Resubmit to committee completed successfully in slice');
      })
      .addCase(resubmitToCommitteeAction.rejected, (state, action) => {
        state.resubmitToCommitteeLoading = false;
        state.resubmitToCommitteeError = action.payload;
        Logger.error('Resubmit to committee failed in slice:', action.payload);
      });

    // Get available transitions
    builder
      .addCase(getAvailableTransitionsAction.pending, state => {
        state.availableTransitionsLoading = true;
        state.availableTransitionsError = null;
      })
      .addCase(getAvailableTransitionsAction.fulfilled, (state, action) => {
        state.availableTransitionsLoading = false;
        state.availableTransitions = action.payload?.data || action.payload || null;
        Logger.info('Get available transitions completed successfully in slice');
      })
      .addCase(getAvailableTransitionsAction.rejected, (state, action) => {
        state.availableTransitionsLoading = false;
        state.availableTransitionsError = action.payload;
        Logger.error('Get available transitions failed in slice:', action.payload);
      });

    // Committee decision (certify / provide feedback)
    builder
      .addCase(committeeDecisionAction.pending, state => {
        state.committeeDecisionLoading = true;
        state.committeeDecisionError = null;
      })
      .addCase(committeeDecisionAction.fulfilled, (state, action) => {
        state.committeeDecisionLoading = false;
        state.committeeDecisionResult = action.payload?.data || action.payload || null;
        Logger.info('Committee decision completed successfully in slice');
      })
      .addCase(committeeDecisionAction.rejected, (state, action) => {
        state.committeeDecisionLoading = false;
        state.committeeDecisionError = action.payload;
        Logger.error('Committee decision failed in slice:', action.payload);
      });

    // Post question clarification (Assessor)
    builder
      .addCase(postQuestionClarificationAction.pending, state => {
        state.postClarificationLoading = true;
        state.postClarificationError = null;
      })
      .addCase(postQuestionClarificationAction.fulfilled, (state, action) => {
        state.postClarificationLoading = false;
        state.postClarificationResult = action.payload?.data || action.payload || null;
        Logger.info('Post question clarification completed successfully in slice');
      })
      .addCase(postQuestionClarificationAction.rejected, (state, action) => {
        state.postClarificationLoading = false;
        state.postClarificationError = action.payload;
        Logger.error('Post question clarification failed in slice:', action.payload);
      });
    // Update question clarification (PATCH)
    builder
      .addCase(updateQuestionClarificationAction.pending, state => {
        state.updateClarificationLoading = true;
        state.updateClarificationError = null;
      })
      .addCase(updateQuestionClarificationAction.fulfilled, (state, action) => {
        state.updateClarificationLoading = false;
        state.updateClarificationResult = action.payload?.data || action.payload || null;
        Logger.info('Update question clarification completed successfully in slice');
      })
      .addCase(updateQuestionClarificationAction.rejected, (state, action) => {
        state.updateClarificationLoading = false;
        state.updateClarificationError = action.payload;
        Logger.error('Update question clarification failed in slice:', action.payload);
      });
    builder
      .addCase(downloadCertificateAction.pending, state => {
        state.downloadLoading = true;
        state.downloadError = null;
      })
      .addCase(downloadCertificateAction.fulfilled, (state, action) => {
        state.downloadLoading = false;
        state.downloadedDocument = action.payload || null;
        Logger.info('Certificate downloaded successfully in slice');
      })
      .addCase(downloadCertificateAction.rejected, (state, action) => {
        state.downloadLoading = false;
        state.downloadError = action.payload;
        Logger.error('Download certificate failed in slice:', action.payload);
      });
    builder
      .addCase(downloadAssessmentReportAction.pending, state => {
        state.downloadReportLoading = true;
        state.downloadReportError = null;
      })
      .addCase(downloadAssessmentReportAction.fulfilled, (state, action) => {
        state.downloadReportLoading = false;
        state.downloadReportdDocument = action.payload || null;
        Logger.info('Certificate downloaded successfully in slice');
      })
      .addCase(downloadAssessmentReportAction.rejected, (state, action) => {
        state.downloadReportLoading = false;
        state.downloadReportError = action.payload;
        Logger.error('Download certificate failed in slice:', action.payload);
      });
    // Execute transition

    // Submit assessment for QC
    builder
      .addCase(submitAssessmentForQcAction.pending, state => {
        state.submitAssessmentForQcLoading = true;
        state.submitAssessmentForQcError = null;
      })
      .addCase(submitAssessmentForQcAction.fulfilled, (state, action) => {
        state.submitAssessmentForQcLoading = false;
        state.submitAssessmentForQcResult = action.payload?.data || action.payload || null;
        Logger.info('Submit assessment for QC completed successfully in slice');
      })
      .addCase(submitAssessmentForQcAction.rejected, (state, action) => {
        state.submitAssessmentForQcLoading = false;
        state.submitAssessmentForQcError = action.payload;
        Logger.error('Submit assessment for QC failed in slice:', action.payload);
      });

    // Co-assessor web submit
    builder
      .addCase(coAssessorSubmitAction.pending, state => {
        state.coAssessorSubmitLoading = true;
        state.coAssessorSubmitError = null;
      })
      .addCase(coAssessorSubmitAction.fulfilled, (state, action) => {
        state.coAssessorSubmitLoading = false;
        state.coAssessorSubmitResult = action.payload?.data || action.payload || null;
        Logger.info('Co-assessor submit completed successfully in slice');
      })
      .addCase(coAssessorSubmitAction.rejected, (state, action) => {
        state.coAssessorSubmitLoading = false;
        state.coAssessorSubmitError = action.payload;
        Logger.error('Co-assessor submit failed in slice:', action.payload);
      });
  },
});

export const {
  resetAssessmentState,
  resetAssessmentErrors,
  resetAssessmentForQcErrors,
  resetCoAssessorSubmit,
  addPendingQc,
  removePendingQc,
  clearPendingQc,
  addPendingRcScore,
  removePendingRcScore,
  clearPendingRcScores,
} = assessmentSlice.actions;
export default assessmentSlice.reducer;
