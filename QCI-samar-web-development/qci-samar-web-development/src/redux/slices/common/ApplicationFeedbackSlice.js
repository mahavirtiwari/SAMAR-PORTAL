import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import {
  getApplicationsForFeedbackAction,
  getFeedbackFormAction,
  getFeedbacksAction,
  getSubmittedFeedbackAction,
  submitBulkFeedbackAction,
  submitFeedbackAction,
} from '../../action/common/ApplicationFeedbackAction';

const initialState = {
  // Applications for feedback list state
  applicationsForFeedback: [],
  applicationsForFeedbackLoading: false,
  applicationsForFeedbackError: null,
  applicationsForFeedbackPagination: {
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
  },

  // Submitted feedback admin listing state
  feedbackSubmissions: [],
  feedbackSubmissionsLoading: false,
  feedbackSubmissionsError: null,
  feedbackSubmissionsPagination: {
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
  },

  // Feedback form state
  feedbackForm: null,
  feedbackFormLoading: false,
  feedbackFormError: null,

  // Feedbacks list state
  feedbacks: [],
  feedbacksLoading: false,
  feedbacksError: null,
  feedbacksPagination: {
    currentPage: 1,
    lastPage: 1,
    perPage: 15,
    total: 0,
  },

  // Submit feedback state
  submitLoading: false,
  submitError: null,
  submitSuccess: false,
  submittedFeedback: null,

  // Bulk submit state
  bulkSubmitLoading: false,
  bulkSubmitError: null,
  bulkSubmitSuccess: false,
  submittedFeedbacks: [],
};

const applicationFeedbackSlice = createSlice({
  name: 'applicationFeedback',
  initialState,
  reducers: {
    resetFeedbackForm(state) {
      state.feedbackForm = null;
      state.feedbackFormLoading = false;
      state.feedbackFormError = null;
    },
    resetSubmitState(state) {
      state.submitLoading = false;
      state.submitError = null;
      state.submitSuccess = false;
      state.submittedFeedback = null;
      state.bulkSubmitLoading = false;
      state.bulkSubmitError = null;
      state.bulkSubmitSuccess = false;
      state.submittedFeedbacks = [];
    },
    clearFeedbacksError(state) {
      state.feedbacksError = null;
    },
  },
  extraReducers: builder => {
    // Get applications for feedback
    builder
      .addCase(getApplicationsForFeedbackAction.pending, state => {
        state.applicationsForFeedbackLoading = true;
        state.applicationsForFeedbackError = null;
      })
      .addCase(getApplicationsForFeedbackAction.fulfilled, (state, action) => {
        state.applicationsForFeedbackLoading = false;
        state.applicationsForFeedback = action.payload?.data || [];
        const applicationsPagination = action.payload?.pagination || action.payload?.meta;
        if (applicationsPagination) {
          state.applicationsForFeedbackPagination = {
            currentPage: applicationsPagination.currentPage,
            lastPage: applicationsPagination.lastPage,
            perPage: applicationsPagination.perPage,
            total: applicationsPagination.total,
          };
        }
        Logger.info('Applications for feedback loaded successfully in slice');
      })
      .addCase(getApplicationsForFeedbackAction.rejected, (state, action) => {
        // Superseded by a newer search/page request, which owns the loading flag.
        if (action.meta.aborted) {
          return;
        }
        state.applicationsForFeedbackLoading = false;
        state.applicationsForFeedbackError = action.payload;
        Logger.error('Get applications for feedback failed in slice:', action.payload);
      });

    // Get submitted feedback (admin listing)
    builder
      .addCase(getSubmittedFeedbackAction.pending, state => {
        state.feedbackSubmissionsLoading = true;
        state.feedbackSubmissionsError = null;
      })
      .addCase(getSubmittedFeedbackAction.fulfilled, (state, action) => {
        state.feedbackSubmissionsLoading = false;
        state.feedbackSubmissions = action.payload?.data || [];
        const submittedPagination = action.payload?.pagination || action.payload?.meta;
        if (submittedPagination) {
          state.feedbackSubmissionsPagination = {
            currentPage: submittedPagination.currentPage,
            lastPage: submittedPagination.lastPage,
            perPage: submittedPagination.perPage,
            total: submittedPagination.total,
          };
        }
        Logger.info('Submitted feedback loaded successfully in slice');
      })
      .addCase(getSubmittedFeedbackAction.rejected, (state, action) => {
        // Superseded by a newer search/page request, which owns the loading flag.
        if (action.meta.aborted) {
          return;
        }
        state.feedbackSubmissionsLoading = false;
        state.feedbackSubmissionsError = action.payload;
        Logger.error('Get submitted feedback failed in slice:', action.payload);
      });

    // Get feedback form
    builder
      .addCase(getFeedbackFormAction.pending, state => {
        state.feedbackFormLoading = true;
        state.feedbackFormError = null;
      })
      .addCase(getFeedbackFormAction.fulfilled, (state, action) => {
        state.feedbackFormLoading = false;
        state.feedbackForm = action.payload?.data || null;
        Logger.info('Feedback form loaded successfully in slice');
      })
      .addCase(getFeedbackFormAction.rejected, (state, action) => {
        state.feedbackFormLoading = false;
        state.feedbackFormError = action.payload;
        Logger.error('Get feedback form failed in slice:', action.payload);
      });

    // Get all feedbacks
    builder
      .addCase(getFeedbacksAction.pending, state => {
        state.feedbacksLoading = true;
        state.feedbacksError = null;
      })
      .addCase(getFeedbacksAction.fulfilled, (state, action) => {
        state.feedbacksLoading = false;
        state.feedbacks = action.payload?.data || [];
        const feedbacksPagination = action.payload?.pagination || action.payload?.meta;
        if (feedbacksPagination) {
          state.feedbacksPagination = {
            currentPage: feedbacksPagination.currentPage,
            lastPage: feedbacksPagination.lastPage,
            perPage: feedbacksPagination.perPage,
            total: feedbacksPagination.total,
          };
        }
        Logger.info('Feedbacks loaded successfully in slice');
      })
      .addCase(getFeedbacksAction.rejected, (state, action) => {
        state.feedbacksLoading = false;
        state.feedbacksError = action.payload;
        Logger.error('Get feedbacks failed in slice:', action.payload);
      });

    // Submit single feedback
    builder
      .addCase(submitFeedbackAction.pending, state => {
        state.submitLoading = true;
        state.submitError = null;
        state.submitSuccess = false;
      })
      .addCase(submitFeedbackAction.fulfilled, (state, action) => {
        state.submitLoading = false;
        state.submitSuccess = true;
        state.submittedFeedback = action.payload?.data || null;
        Logger.info('Feedback submitted successfully in slice');
      })
      .addCase(submitFeedbackAction.rejected, (state, action) => {
        state.submitLoading = false;
        state.submitError = action.payload;
        state.submitSuccess = false;
        Logger.error('Submit feedback failed in slice:', action.payload);
      });

    // Submit bulk feedback
    builder
      .addCase(submitBulkFeedbackAction.pending, state => {
        state.bulkSubmitLoading = true;
        state.bulkSubmitError = null;
        state.bulkSubmitSuccess = false;
      })
      .addCase(submitBulkFeedbackAction.fulfilled, (state, action) => {
        state.bulkSubmitLoading = false;
        state.bulkSubmitSuccess = true;
        state.submittedFeedbacks = action.payload?.data || [];
        Logger.info('Bulk feedback submitted successfully in slice');
      })
      .addCase(submitBulkFeedbackAction.rejected, (state, action) => {
        state.bulkSubmitLoading = false;
        state.bulkSubmitError = action.payload;
        state.bulkSubmitSuccess = false;
        Logger.error('Submit bulk feedback failed in slice:', action.payload);
      });
  },
});

export const { resetFeedbackForm, resetSubmitState, clearFeedbacksError } = applicationFeedbackSlice.actions;
export default applicationFeedbackSlice.reducer;
