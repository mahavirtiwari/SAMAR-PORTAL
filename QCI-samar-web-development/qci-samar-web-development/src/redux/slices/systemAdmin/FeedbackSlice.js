import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import {
  activateFeedbackQuestionAction,
  createFeedbackQuestionAction,
  deactivateFeedbackQuestionAction,
  getFeedbackQuestionByIdAction,
  getFeedbackQuestionsAction,
  updateFeedbackQuestionAction,
} from '../../action/systemAdmin/FeedbackAction';

const initialState = {
  feedbackQuestions: [],
  feedbackQuestionsLoading: false,
  feedbackQuestionsError: null,

  feedbackQuestion: null,
  feedbackQuestionLoading: false,
  feedbackQuestionError: null,

  createLoading: false,
  createError: null,
  createdFeedbackQuestion: null,

  updateLoading: false,
  updateError: null,
  updatedFeedbackQuestion: null,

  activateLoading: false,
  activateError: null,
  activatedFeedbackQuestion: null,

  deactivateLoading: false,
  deactivateError: null,
  deactivatedFeedbackQuestion: null,
};

const feedbackSlice = createSlice({
  name: 'feedback',
  initialState,
  reducers: {
    resetFeedbackCreateUpdateDelete(state) {
      state.createLoading = false;
      state.createError = null;
      state.createdFeedbackQuestion = null;
      state.updateLoading = false;
      state.updateError = null;
      state.updatedFeedbackQuestion = null;
    },
    resetActivateDeactivateState(state) {
      state.activateLoading = false;
      state.activateError = null;
      state.activatedFeedbackQuestion = null;
      state.deactivateLoading = false;
      state.deactivateError = null;
      state.deactivatedFeedbackQuestion = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(getFeedbackQuestionsAction.pending, state => {
        state.feedbackQuestionsLoading = true;
        state.feedbackQuestionsError = null;
      })
      .addCase(getFeedbackQuestionsAction.fulfilled, (state, action) => {
        state.feedbackQuestionsLoading = false;
        state.feedbackQuestions = action.payload || [];
        Logger.info('Feedback questions loaded successfully in slice');
      })
      .addCase(getFeedbackQuestionsAction.rejected, (state, action) => {
        state.feedbackQuestionsLoading = false;
        state.feedbackQuestionsError = action.payload;
        Logger.error('Get feedback questions failed in slice:', action.payload);
      });

    builder
      .addCase(getFeedbackQuestionByIdAction.pending, state => {
        state.feedbackQuestionLoading = true;
        state.feedbackQuestionError = null;
      })
      .addCase(getFeedbackQuestionByIdAction.fulfilled, (state, action) => {
        state.feedbackQuestionLoading = false;
        state.feedbackQuestion = action.payload || null;
        Logger.info('Feedback question loaded successfully in slice');
      })
      .addCase(getFeedbackQuestionByIdAction.rejected, (state, action) => {
        state.feedbackQuestionLoading = false;
        state.feedbackQuestionError = action.payload;
        Logger.error('Get feedback question failed in slice:', action.payload);
      });

    builder
      .addCase(createFeedbackQuestionAction.pending, state => {
        state.createLoading = true;
        state.createError = null;
      })
      .addCase(createFeedbackQuestionAction.fulfilled, (state, action) => {
        state.createLoading = false;
        state.createdFeedbackQuestion = action.payload || null;
        Logger.info('Feedback question created successfully in slice');
      })
      .addCase(createFeedbackQuestionAction.rejected, (state, action) => {
        state.createLoading = false;
        state.createError = action.payload;
        Logger.error('Create feedback question failed in slice:', action.payload);
      });

    builder
      .addCase(updateFeedbackQuestionAction.pending, state => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updateFeedbackQuestionAction.fulfilled, (state, action) => {
        state.updateLoading = false;
        state.updatedFeedbackQuestion = action.payload || null;
        Logger.info('Feedback question updated successfully in slice');
      })
      .addCase(updateFeedbackQuestionAction.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload;
        Logger.error('Update feedback question failed in slice:', action.payload);
      });

    builder
      .addCase(activateFeedbackQuestionAction.pending, state => {
        state.activateLoading = true;
        state.activateError = null;
      })
      .addCase(activateFeedbackQuestionAction.fulfilled, (state, action) => {
        state.activateLoading = false;
        state.activatedFeedbackQuestion = action.payload;
        Logger.info('Feedback question activated successfully in slice');
      })
      .addCase(activateFeedbackQuestionAction.rejected, (state, action) => {
        state.activateLoading = false;
        state.activateError = action.payload;
        Logger.error('Activate feedback question failed in slice:', action.payload);
      });

    builder
      .addCase(deactivateFeedbackQuestionAction.pending, state => {
        state.deactivateLoading = true;
        state.deactivateError = null;
      })
      .addCase(deactivateFeedbackQuestionAction.fulfilled, (state, action) => {
        state.deactivateLoading = false;
        state.deactivatedFeedbackQuestion = action.payload;
        Logger.info('Feedback question deactivated successfully in slice');
      })
      .addCase(deactivateFeedbackQuestionAction.rejected, (state, action) => {
        state.deactivateLoading = false;
        state.deactivateError = action.payload;
        Logger.error('Deactivate feedback question failed in slice:', action.payload);
      });
  },
});
export const { resetFeedbackCreateUpdateDelete, resetActivateDeactivateState } = feedbackSlice.actions;
export default feedbackSlice.reducer;
