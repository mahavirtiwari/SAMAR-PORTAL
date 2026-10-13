import { createSlice } from '@reduxjs/toolkit';
import {
  AddAssessmentResponse,
  addResponseEvidenceAction,
  deleteResponseEvidenceAction,
  getAssessmentResponseByIdAction,
  getAssessmentResponsesAction,
  getResponseEvidencesAction
} from '../action/assessmentResponseAction';

const initialState = {
  // Get Assessment Responses
  assessmentResponsesLoading: false,
  assessmentResponsesError: null,
  assessmentResponses: null,

  // Get Assessment Response By ID
  assessmentResponseByIdLoading: false,
  assessmentResponseByIdError: null,
  assessmentResponseById: null,

  // Update Assessment Response
  updateAssessmentResponseLoading: false,
  updateAssessmentResponseError: null,
  updateAssessmentResponseData: null,

  // Bulk Update Assessment Responses
  bulkUpdateAssessmentResponsesLoading: false,
  bulkUpdateAssessmentResponsesError: null,
  bulkUpdateAssessmentResponsesData: null,

  // Get Response Evidences
  responseEvidencesLoading: false,
  responseEvidencesError: null,
  responseEvidences: null,

  // Add Response Evidence
  addResponseEvidenceLoading: false,
  addResponseEvidenceError: null,
  addResponseEvidenceData: null,

  // Delete Response Evidence
  deleteResponseEvidenceLoading: false,
  deleteResponseEvidenceError: null,
  deleteResponseEvidenceData: null
};

const assessmentResponseSlice = createSlice({
  name: 'assessmentResponse',
  initialState,
  reducers: {
    // Reset individual states
    resetAssessmentResponsesState: (state) => {
      state.assessmentResponsesLoading = false;
      state.assessmentResponsesError = null;
      state.assessmentResponses = null;
    },
    resetAssessmentResponseByIdState: (state) => {
      state.assessmentResponseByIdLoading = false;
      state.assessmentResponseByIdError = null;
      state.assessmentResponseById = null;
    },
    resetUpdateAssessmentResponseState: (state) => {
      state.updateAssessmentResponseLoading = false;
      state.updateAssessmentResponseError = null;
      state.updateAssessmentResponseData = null;
    },
    resetBulkUpdateAssessmentResponsesState: (state) => {
      state.bulkUpdateAssessmentResponsesLoading = false;
      state.bulkUpdateAssessmentResponsesError = null;
      state.bulkUpdateAssessmentResponsesData = null;
    },
    resetResponseEvidencesState: (state) => {
      state.responseEvidencesLoading = false;
      state.responseEvidencesError = null;
      state.responseEvidences = null;
    },
    resetAddResponseEvidenceState: (state) => {
      state.addResponseEvidenceLoading = false;
      state.addResponseEvidenceError = null;
      state.addResponseEvidenceData = null;
    },
    resetDeleteResponseEvidenceState: (state) => {
      state.deleteResponseEvidenceLoading = false;
      state.deleteResponseEvidenceError = null;
      state.deleteResponseEvidenceData = null;
    },
    // Reset entire assessment response state
    resetAssessmentResponseSliceState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // Get Assessment Responses
      .addCase(getAssessmentResponsesAction.pending, (state) => {
        state.assessmentResponsesLoading = true;
        state.assessmentResponsesError = null;
      })
      .addCase(getAssessmentResponsesAction.fulfilled, (state, action) => {
        state.assessmentResponsesLoading = false;
        state.assessmentResponses = action.payload;
        state.assessmentResponsesError = null;
      })
      .addCase(getAssessmentResponsesAction.rejected, (state, action) => {
        state.assessmentResponsesLoading = false;
        state.assessmentResponsesError = action.payload;
        state.assessmentResponses = null;
      })

      // Get Assessment Response By ID
      .addCase(getAssessmentResponseByIdAction.pending, (state) => {
        state.assessmentResponseByIdLoading = true;
        state.assessmentResponseByIdError = null;
      })
      .addCase(getAssessmentResponseByIdAction.fulfilled, (state, action) => {
        state.assessmentResponseByIdLoading = false;
        state.assessmentResponseById = action.payload;
        state.assessmentResponseByIdError = null;
      })
      .addCase(getAssessmentResponseByIdAction.rejected, (state, action) => {
        state.assessmentResponseByIdLoading = false;
        state.assessmentResponseByIdError = action.payload;
        state.assessmentResponseById = null;
      })
      // Bulk Update Assessment Responses
      .addCase(AddAssessmentResponse.pending, (state) => {
        state.bulkUpdateAssessmentResponsesLoading = true;
        state.bulkUpdateAssessmentResponsesError = null;
      })
      .addCase(AddAssessmentResponse.fulfilled, (state, action) => {
        state.bulkUpdateAssessmentResponsesLoading = false;
        state.bulkUpdateAssessmentResponsesData = action.payload;
        state.bulkUpdateAssessmentResponsesError = null;
      })
      .addCase(AddAssessmentResponse.rejected, (state, action) => {
        state.bulkUpdateAssessmentResponsesLoading = false;
        state.bulkUpdateAssessmentResponsesError = action.payload;
        state.bulkUpdateAssessmentResponsesData = null;
      })

      // Get Response Evidences
      .addCase(getResponseEvidencesAction.pending, (state) => {
        state.responseEvidencesLoading = true;
        state.responseEvidencesError = null;
      })
      .addCase(getResponseEvidencesAction.fulfilled, (state, action) => {
        state.responseEvidencesLoading = false;
        state.responseEvidences = action.payload;
        state.responseEvidencesError = null;
      })
      .addCase(getResponseEvidencesAction.rejected, (state, action) => {
        state.responseEvidencesLoading = false;
        state.responseEvidencesError = action.payload;
        state.responseEvidences = null;
      })

      // Add Response Evidence
      .addCase(addResponseEvidenceAction.pending, (state) => {
        state.addResponseEvidenceLoading = true;
        state.addResponseEvidenceError = null;
      })
      .addCase(addResponseEvidenceAction.fulfilled, (state, action) => {
        state.addResponseEvidenceLoading = false;
        state.addResponseEvidenceData = action.payload;
        state.addResponseEvidenceError = null;
      })
      .addCase(addResponseEvidenceAction.rejected, (state, action) => {
        state.addResponseEvidenceLoading = false;
        state.addResponseEvidenceError = action.payload;
        state.addResponseEvidenceData = null;
      })

      // Delete Response Evidence
      .addCase(deleteResponseEvidenceAction.pending, (state) => {
        state.deleteResponseEvidenceLoading = true;
        state.deleteResponseEvidenceError = null;
      })
      .addCase(deleteResponseEvidenceAction.fulfilled, (state, action) => {
        state.deleteResponseEvidenceLoading = false;
        state.deleteResponseEvidenceData = action.payload;
        state.deleteResponseEvidenceError = null;
      })
      .addCase(deleteResponseEvidenceAction.rejected, (state, action) => {
        state.deleteResponseEvidenceLoading = false;
        state.deleteResponseEvidenceError = action.payload;
        state.deleteResponseEvidenceData = null;
      });
  }
});

export const {
  resetAssessmentResponsesState,
  resetAssessmentResponseByIdState,
  resetUpdateAssessmentResponseState,
  resetBulkUpdateAssessmentResponsesState,
  resetResponseEvidencesState,
  resetAddResponseEvidenceState,
  resetDeleteResponseEvidenceState,
  resetAssessmentResponseSliceState
} = assessmentResponseSlice.actions;

export default assessmentResponseSlice.reducer;
