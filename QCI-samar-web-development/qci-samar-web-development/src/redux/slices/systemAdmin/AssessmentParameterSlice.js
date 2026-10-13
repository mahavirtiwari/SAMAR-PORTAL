import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import {
  activateAssessmentParameterAction,
  activateAssessmentQuestionAction,
  activateAssessmentQuestionOptionAction,
  addAssessmentQuestionOptionAction,
  bulkImportAssessmentParametersAction,
  bulkUpdateAssessmentParametersAction,
  createAssessmentParameterAction,
  // Add new actions for assessment questions/options
  createAssessmentQuestionAction,
  deactivateAssessmentParameterAction,
  deactivateAssessmentQuestionAction,
  deactivateAssessmentQuestionOptionAction,
  deleteAssessmentParameterAction,
  deleteAssessmentQuestionAction,
  deleteAssessmentQuestionOptionAction,
  getAssessmentParameterByIdAction,
  getAssessmentParameterQuestionsAction,
  getAssessmentParametersAction,
  getAssessmentQuestionDetailsAction,
  getAssessmentQuestionOptionsAction,
  updateAssessmentParameterAction,
  updateAssessmentQuestionAction,
  updateAssessmentQuestionOptionAction,
} from '../../action/systemAdmin/AssessmentParameterAction';

const initialState = {
  assessmentParameters: [],
  assessmentParametersLoading: false,
  assessmentParametersError: null,

  assessmentParameter: null,
  assessmentParameterLoading: false,
  assessmentParameterError: null,

  createLoading: false,
  createError: null,
  createdAssessmentParameter: null,

  updateLoading: false,
  updateError: null,
  updatedAssessmentParameter: null,

  deleteLoading: false,
  deleteError: null,
  deletedAssessmentParameter: null,

  activateLoading: false,
  activateError: null,
  activatedAssessmentParameter: null,

  deactivateLoading: false,
  deactivateError: null,
  deactivatedAssessmentParameter: null,

  // Assessment Question State
  assessmentQuestions: [],
  assessmentQuestionsLoading: false,
  assessmentQuestionsError: null,

  assessmentQuestion: null,
  assessmentQuestionLoading: false,
  assessmentQuestionError: null,

  createQuestionLoading: false,
  createQuestionError: null,
  createdAssessmentQuestion: null,

  updateQuestionLoading: false,
  updateQuestionError: null,
  updatedAssessmentQuestion: null,

  deleteQuestionLoading: false,
  deleteQuestionError: null,
  deletedAssessmentQuestion: null,

  activateQuestionLoading: false,
  activateQuestionError: null,
  activatedAssessmentQuestion: null,

  deactivateQuestionLoading: false,
  deactivateQuestionError: null,
  deactivatedAssessmentQuestion: null,

  // Option State
  assessmentQuestionOptions: [],
  assessmentQuestionOptionsLoading: false,
  assessmentQuestionOptionsError: null,

  addOptionLoading: false,
  addOptionError: null,
  addedAssessmentQuestionOption: null,

  updateOptionLoading: false,
  updateOptionError: null,
  updatedAssessmentQuestionOption: null,

  deleteOptionLoading: false,
  deleteOptionError: null,
  deletedAssessmentQuestionOption: null,

  activateOptionLoading: false,
  activateOptionError: null,
  activatedAssessmentQuestionOption: null,

  deactivateOptionLoading: false,
  deactivateOptionError: null,
  deactivatedAssessmentQuestionOption: null,

  // Questions for a specific assessment parameter
  assessmentParameterQuestions: [],
  assessmentParameterQuestionsPagination: null,
  assessmentParameterQuestionsLoading: false,
  assessmentParameterQuestionsError: null,
  // Bulk Import State
  bulkImportLoading: false,
  bulkImportError: null,
  bulkImportResult: null,

  // Bulk Update State
  bulkUpdateLoading: false,
  bulkUpdateError: null,
  bulkUpdateResult: null,
};

const assessmentParameterSlice = createSlice({
  name: 'assessmentParameters',
  initialState,
  reducers: {
    resetAssessmentParameterCreateUpdateDelete(state) {
      state.createLoading = false;
      state.createError = null;
      state.createdAssessmentParameter = null;
      state.updateLoading = false;
      state.updateError = null;
      state.updatedAssessmentParameter = null;
      state.deleteLoading = false;
      state.deleteError = null;
      state.deletedAssessmentParameter = null;
      state.activateLoading = false;
      state.activateError = null;
      state.activatedAssessmentParameter = null;
      state.deactivateLoading = false;
      state.deactivateError = null;
      state.deactivatedAssessmentParameter = null;

      // Reset question/option states as well
      state.createQuestionLoading = false;
      state.createQuestionError = null;
      state.createdAssessmentQuestion = null;
      state.updateQuestionLoading = false;
      state.updateQuestionError = null;
      state.updatedAssessmentQuestion = null;
      state.deleteQuestionLoading = false;
      state.deleteQuestionError = null;
      state.deletedAssessmentQuestion = null;
      state.activateQuestionLoading = false;
      state.activateQuestionError = null;
      state.activatedAssessmentQuestion = null;
      state.deactivateQuestionLoading = false;
      state.deactivateQuestionError = null;
      state.deactivatedAssessmentQuestion = null;

      state.assessmentQuestionOptionsLoading = false;
      state.assessmentQuestionOptionsError = null;
      state.addOptionLoading = false;
      state.addOptionError = null;
      state.addedAssessmentQuestionOption = null;
      state.updateOptionLoading = false;
      state.updateOptionError = null;
      state.updatedAssessmentQuestionOption = null;
      state.deleteOptionLoading = false;
      state.deleteOptionError = null;
      state.deletedAssessmentQuestionOption = null;
      state.activateOptionLoading = false;
      state.activateOptionError = null;
      state.activatedAssessmentQuestionOption = null;
      state.deactivateOptionLoading = false;
      state.deactivateOptionError = null;
      state.deactivatedAssessmentQuestionOption = null;

      // Only reset loading/error states, NOT the data itself
      state.assessmentParameterQuestionsLoading = false;
      state.assessmentParameterQuestionsError = null;
      // DO NOT reset assessmentParameterQuestions here - it clears the table when modal closes

      // Bulk import reset
      state.bulkImportLoading = false;
      state.bulkImportError = null;
      state.bulkImportResult = null;

      // Bulk update reset
      state.bulkUpdateLoading = false;
      state.bulkUpdateError = null;
      state.bulkUpdateResult = null;
    },
    // Targeted reset for question modals - only resets create/update error states
    // Does NOT reset activate/deactivate states to avoid triggering parent screen's useEffect
    resetAssessmentQuestionErrors(state) {
      state.createQuestionLoading = false;
      state.createQuestionError = null;
      state.updateQuestionLoading = false;
      state.updateQuestionError = null;
      state.addOptionLoading = false;
      state.addOptionError = null;
      state.updateOptionLoading = false;
      state.updateOptionError = null;
      state.deleteOptionLoading = false;
      state.deleteOptionError = null;
      // DO NOT reset createdAssessmentQuestion, activatedAssessmentQuestion, etc.
      // to avoid triggering parent screen's refresh useEffect
    },
  },
  extraReducers: builder => {
    builder
      // Bulk import assessment parameters
      .addCase(bulkImportAssessmentParametersAction.pending, state => {
        state.bulkImportLoading = true;
        state.bulkImportError = null;
        state.bulkImportResult = null;
      })
      .addCase(bulkImportAssessmentParametersAction.fulfilled, (state, action) => {
        state.bulkImportLoading = false;
        state.bulkImportResult = action.payload || null;
        state.bulkImportError = null;
        Logger.info('Bulk import assessment parameters successful in slice');
      })
      .addCase(bulkImportAssessmentParametersAction.rejected, (state, action) => {
        state.bulkImportLoading = false;
        state.bulkImportError = action.payload;
        state.bulkImportResult = null;
        Logger.error('Bulk import assessment parameters failed in slice:', action.payload);
      })
      // Bulk update assessment parameters
      .addCase(bulkUpdateAssessmentParametersAction.pending, state => {
        state.bulkUpdateLoading = true;
        state.bulkUpdateError = null;
        state.bulkUpdateResult = null;
      })
      .addCase(bulkUpdateAssessmentParametersAction.fulfilled, (state, action) => {
        state.bulkUpdateLoading = false;
        state.bulkUpdateResult = action.payload || null;
        state.bulkUpdateError = null;
        Logger.info('Bulk update assessment parameters successful in slice');
      })
      .addCase(bulkUpdateAssessmentParametersAction.rejected, (state, action) => {
        state.bulkUpdateLoading = false;
        state.bulkUpdateError = action.payload;
        state.bulkUpdateResult = null;
        Logger.error('Bulk update assessment parameters failed in slice:', action.payload);
      })
      // Get all assessment parameters
      .addCase(getAssessmentParametersAction.pending, state => {
        state.assessmentParametersLoading = true;
        state.assessmentParametersError = null;
      })
      .addCase(getAssessmentParametersAction.fulfilled, (state, action) => {
        state.assessmentParametersLoading = false;
        state.assessmentParameters = action.payload || [];
        Logger.info('Assessment parameters loaded successfully in slice');
      })
      .addCase(getAssessmentParametersAction.rejected, (state, action) => {
        state.assessmentParametersLoading = false;
        state.assessmentParametersError = action.payload;
        Logger.error('Get assessment parameters failed in slice:', action.payload);
      })

      // Get assessment parameter by ID
      .addCase(getAssessmentParameterByIdAction.pending, state => {
        state.assessmentParameterLoading = true;
        state.assessmentParameterError = null;
      })
      .addCase(getAssessmentParameterByIdAction.fulfilled, (state, action) => {
        state.assessmentParameterLoading = false;
        state.assessmentParameter = action.payload || null;
        Logger.info('Assessment parameter loaded successfully in slice');
      })
      .addCase(getAssessmentParameterByIdAction.rejected, (state, action) => {
        state.assessmentParameterLoading = false;
        state.assessmentParameterError = action.payload;
        Logger.error('Get assessment parameter failed in slice:', action.payload);
      })

      // Create assessment parameter
      .addCase(createAssessmentParameterAction.pending, state => {
        state.createLoading = true;
        state.createError = null;
      })
      .addCase(createAssessmentParameterAction.fulfilled, (state, action) => {
        state.createLoading = false;
        state.createdAssessmentParameter = action.payload || null;
        Logger.info('Assessment parameter created successfully in slice');
      })
      .addCase(createAssessmentParameterAction.rejected, (state, action) => {
        state.createLoading = false;
        state.createError = action.payload;
        Logger.error('Create assessment parameter failed in slice:', action.payload);
      })

      // Update assessment parameter
      .addCase(updateAssessmentParameterAction.pending, state => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updateAssessmentParameterAction.fulfilled, (state, action) => {
        state.updateLoading = false;
        state.updatedAssessmentParameter = action.payload || null;
        Logger.info('Assessment parameter updated successfully in slice');
      })
      .addCase(updateAssessmentParameterAction.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload;
        Logger.error('Update assessment parameter failed in slice:', action.payload);
      })

      // Delete assessment parameter
      .addCase(deleteAssessmentParameterAction.pending, state => {
        state.deleteLoading = true;
        state.deleteError = null;
      })
      .addCase(deleteAssessmentParameterAction.fulfilled, (state, action) => {
        state.deleteLoading = false;
        state.deletedAssessmentParameter = action.payload || null;
        Logger.info('Assessment parameter deleted successfully in slice');
      })
      .addCase(deleteAssessmentParameterAction.rejected, (state, action) => {
        state.deleteLoading = false;
        state.deleteError = action.payload;
        Logger.error('Delete assessment parameter failed in slice:', action.payload);
      })

      // Activate assessment parameter
      .addCase(activateAssessmentParameterAction.pending, state => {
        state.activateLoading = true;
        state.activateError = null;
      })
      .addCase(activateAssessmentParameterAction.fulfilled, (state, action) => {
        state.activateLoading = false;
        state.activatedAssessmentParameter = action.payload || null;
        Logger.info('Assessment parameter activated successfully in slice');
      })
      .addCase(activateAssessmentParameterAction.rejected, (state, action) => {
        state.activateLoading = false;
        state.activateError = action.payload;
        Logger.error('Activate assessment parameter failed in slice:', action.payload);
      })

      // Deactivate assessment parameter
      .addCase(deactivateAssessmentParameterAction.pending, state => {
        state.deactivateLoading = true;
        state.deactivateError = null;
      })
      .addCase(deactivateAssessmentParameterAction.fulfilled, (state, action) => {
        state.deactivateLoading = false;
        state.deactivatedAssessmentParameter = action.payload || null;
        Logger.info('Assessment parameter deactivated successfully in slice');
      })
      .addCase(deactivateAssessmentParameterAction.rejected, (state, action) => {
        state.deactivateLoading = false;
        state.deactivateError = action.payload;
        Logger.error('Deactivate assessment parameter failed in slice:', action.payload);
      })

      // Create assessment question
      .addCase(createAssessmentQuestionAction.pending, state => {
        state.createQuestionLoading = true;
        state.createQuestionError = null;
      })
      .addCase(createAssessmentQuestionAction.fulfilled, (state, action) => {
        state.createQuestionLoading = false;
        state.createdAssessmentQuestion = action.payload || null;
        Logger.info('Assessment question created successfully in slice');
      })
      .addCase(createAssessmentQuestionAction.rejected, (state, action) => {
        state.createQuestionLoading = false;
        state.createQuestionError = action.payload;
        Logger.error('Create assessment question failed in slice:', action.payload);
      })

      // Get assessment question details
      .addCase(getAssessmentQuestionDetailsAction.pending, state => {
        state.assessmentQuestionLoading = true;
        state.assessmentQuestionError = null;
      })
      .addCase(getAssessmentQuestionDetailsAction.fulfilled, (state, action) => {
        state.assessmentQuestionLoading = false;
        state.assessmentQuestion = action.payload || null;
        Logger.info('Assessment question details loaded successfully in slice');
      })
      .addCase(getAssessmentQuestionDetailsAction.rejected, (state, action) => {
        state.assessmentQuestionLoading = false;
        state.assessmentQuestionError = action.payload;
        Logger.error('Get assessment question details failed in slice:', action.payload);
      })

      // Update assessment question
      .addCase(updateAssessmentQuestionAction.pending, state => {
        state.updateQuestionLoading = true;
        state.updateQuestionError = null;
      })
      .addCase(updateAssessmentQuestionAction.fulfilled, (state, action) => {
        state.updateQuestionLoading = false;
        state.updatedAssessmentQuestion = action.payload || null;
        Logger.info('Assessment question updated successfully in slice');
      })
      .addCase(updateAssessmentQuestionAction.rejected, (state, action) => {
        state.updateQuestionLoading = false;
        state.updateQuestionError = action.payload;
        Logger.error('Update assessment question failed in slice:', action.payload);
      })

      // Delete assessment question
      .addCase(deleteAssessmentQuestionAction.pending, state => {
        state.deleteQuestionLoading = true;
        state.deleteQuestionError = null;
      })
      .addCase(deleteAssessmentQuestionAction.fulfilled, (state, action) => {
        state.deleteQuestionLoading = false;
        state.deletedAssessmentQuestion = action.payload || null;
        Logger.info('Assessment question deleted successfully in slice');
      })
      .addCase(deleteAssessmentQuestionAction.rejected, (state, action) => {
        state.deleteQuestionLoading = false;
        state.deleteQuestionError = action.payload;
        Logger.error('Delete assessment question failed in slice:', action.payload);
      })

      // Get assessment question options
      .addCase(getAssessmentQuestionOptionsAction.pending, state => {
        state.assessmentQuestionOptionsLoading = true;
        state.assessmentQuestionOptionsError = null;
      })
      .addCase(getAssessmentQuestionOptionsAction.fulfilled, (state, action) => {
        state.assessmentQuestionOptionsLoading = false;
        state.assessmentQuestionOptions = action.payload || [];
        Logger.info('Assessment question options loaded successfully in slice');
      })
      .addCase(getAssessmentQuestionOptionsAction.rejected, (state, action) => {
        state.assessmentQuestionOptionsLoading = false;
        state.assessmentQuestionOptionsError = action.payload;
        Logger.error('Get assessment question options failed in slice:', action.payload);
      })

      // Add assessment question option
      .addCase(addAssessmentQuestionOptionAction.pending, state => {
        state.addOptionLoading = true;
        state.addOptionError = null;
      })
      .addCase(addAssessmentQuestionOptionAction.fulfilled, (state, action) => {
        state.addOptionLoading = false;
        state.addedAssessmentQuestionOption = action.payload || null;
        Logger.info('Assessment question option added successfully in slice');
      })
      .addCase(addAssessmentQuestionOptionAction.rejected, (state, action) => {
        state.addOptionLoading = false;
        state.addOptionError = action.payload;
        Logger.error('Add assessment question option failed in slice:', action.payload);
      })

      // Update assessment question option
      .addCase(updateAssessmentQuestionOptionAction.pending, state => {
        state.updateOptionLoading = true;
        state.updateOptionError = null;
      })
      .addCase(updateAssessmentQuestionOptionAction.fulfilled, (state, action) => {
        state.updateOptionLoading = false;
        state.updatedAssessmentQuestionOption = action.payload || null;
        Logger.info('Assessment question option updated successfully in slice');
      })
      .addCase(updateAssessmentQuestionOptionAction.rejected, (state, action) => {
        state.updateOptionLoading = false;
        state.updateOptionError = action.payload;
        Logger.error('Update assessment question option failed in slice:', action.payload);
      })

      // Delete assessment question option
      .addCase(deleteAssessmentQuestionOptionAction.pending, state => {
        state.deleteOptionLoading = true;
        state.deleteOptionError = null;
      })
      .addCase(deleteAssessmentQuestionOptionAction.fulfilled, (state, action) => {
        state.deleteOptionLoading = false;
        state.deletedAssessmentQuestionOption = action.payload || null;
        Logger.info('Assessment question option deleted successfully in slice');
      })
      .addCase(deleteAssessmentQuestionOptionAction.rejected, (state, action) => {
        state.deleteOptionLoading = false;
        state.deleteOptionError = action.payload;
        Logger.error('Delete assessment question option failed in slice:', action.payload);
      })

      // Activate assessment question
      .addCase(activateAssessmentQuestionAction.pending, state => {
        state.activateQuestionLoading = true;
        state.activateQuestionError = null;
      })
      .addCase(activateAssessmentQuestionAction.fulfilled, (state, action) => {
        state.activateQuestionLoading = false;
        state.activatedAssessmentQuestion = action.payload || null;
        Logger.info('Assessment question activated successfully in slice');
      })
      .addCase(activateAssessmentQuestionAction.rejected, (state, action) => {
        state.activateQuestionLoading = false;
        state.activateQuestionError = action.payload;

        Logger.error('Activate assessment question failed in slice:', action.payload);
      })

      // Deactivate assessment question
      .addCase(deactivateAssessmentQuestionAction.pending, state => {
        state.deactivateQuestionLoading = true;
        state.deactivateQuestionError = null;
      })
      .addCase(deactivateAssessmentQuestionAction.fulfilled, (state, action) => {
        state.deactivateQuestionLoading = false;
        state.deactivatedAssessmentQuestion = action.payload || null;
        Logger.info('Assessment question deactivated successfully in slice');
      })
      .addCase(deactivateAssessmentQuestionAction.rejected, (state, action) => {
        state.deactivateQuestionLoading = false;
        state.deactivateQuestionError = action.payload;
        Logger.error('Deactivate assessment question failed in slice:', action.payload);
      })

      // Activate assessment question option
      .addCase(activateAssessmentQuestionOptionAction.pending, state => {
        state.activateOptionLoading = true;
        state.activateOptionError = null;
      })
      .addCase(activateAssessmentQuestionOptionAction.fulfilled, (state, action) => {
        state.activateOptionLoading = false;
        state.activatedAssessmentQuestionOption = action.payload || null;
        Logger.info('Assessment question option activated successfully in slice');
      })
      .addCase(activateAssessmentQuestionOptionAction.rejected, (state, action) => {
        state.activateOptionLoading = false;
        state.activateOptionError = action.payload;
        Logger.error('Activate assessment question option failed in slice:', action.payload);
      })

      // Deactivate assessment question option
      .addCase(deactivateAssessmentQuestionOptionAction.pending, state => {
        state.deactivateOptionLoading = true;
        state.deactivateOptionError = null;
      })
      .addCase(deactivateAssessmentQuestionOptionAction.fulfilled, (state, action) => {
        state.deactivateOptionLoading = false;
        state.deactivatedAssessmentQuestionOption = action.payload || null;
        Logger.info('Assessment question option deactivated successfully in slice');
      })
      .addCase(deactivateAssessmentQuestionOptionAction.rejected, (state, action) => {
        state.deactivateOptionLoading = false;
        state.deactivateOptionError = action.payload;
        Logger.error('Deactivate assessment question option failed in slice:', action.payload);
      })

      // Get questions for a specific assessment parameter
      .addCase(getAssessmentParameterQuestionsAction.pending, state => {
        state.assessmentParameterQuestionsLoading = true;
        state.assessmentParameterQuestionsError = null;
      })
      .addCase(getAssessmentParameterQuestionsAction.fulfilled, (state, action) => {
        state.assessmentParameterQuestionsLoading = false;
        const payload = action.payload;
        if (payload && Array.isArray(payload.data)) {
          state.assessmentParameterQuestions = payload.data;
          state.assessmentParameterQuestionsPagination = payload.pagination ?? null;
        } else {
          state.assessmentParameterQuestions = Array.isArray(payload) ? payload : [];
          state.assessmentParameterQuestionsPagination = null;
        }
        Logger.info('Assessment parameter questions loaded successfully in slice');
      })
      .addCase(getAssessmentParameterQuestionsAction.rejected, (state, action) => {
        state.assessmentParameterQuestionsLoading = false;
        state.assessmentParameterQuestionsError = action.payload;
        Logger.error('Get assessment parameter questions failed in slice:', action.payload);
      });
  },
});

export const { resetAssessmentParameterCreateUpdateDelete, resetAssessmentQuestionErrors } = assessmentParameterSlice.actions;
export default assessmentParameterSlice.reducer;
