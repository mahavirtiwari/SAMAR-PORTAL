import { createSlice } from '@reduxjs/toolkit';
import {
  bulkAssignParametersAction,
  getAssessmentParametersAction,
  getMyAssessmentsAction
} from '../action/assessmentParameterAction';

const initialState = {
  // Get Assessment Parameters
  assessmentParametersLoading: true,
  assessmentParametersError: null,
  assessmentParameters: null,

  // Get My Assessments
  myAssessmentsLoading: false,
  myAssessmentsError: null,
  myAssessments: null,

  // Bulk Assign Parameters
  bulkAssignParametersLoading: false,
  bulkAssignParametersError: null,
  bulkAssignParametersData: null,

  selectAllParameter: []
};

const assessmentParameterSlice = createSlice({
  name: 'assessmentParameter',
  initialState,
  reducers: {
    setSelectAllParameter: (state, action) => {
      state.selectAllParameter = Array.isArray(action.payload) ? action.payload : [action.payload];
    },
    // Reset individual states
    resetAssessmentParametersState: (state) => {
      state.assessmentParametersLoading = false;
      state.assessmentParametersError = null;
      state.assessmentParameters = null;
    },
    resetMyAssessmentsState: (state) => {
      state.myAssessmentsLoading = false;
      state.myAssessmentsError = null;
      state.myAssessments = null;
    },
    resetBulkAssignParametersState: (state) => {
      state.bulkAssignParametersLoading = false;
      state.bulkAssignParametersError = null;
      state.bulkAssignParametersData = null;
    },
    // Reset entire assessment parameter state
    resetAssessmentParameterSliceState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // Get Assessment Parameters
      .addCase(getAssessmentParametersAction.pending, (state) => {
        state.assessmentParametersLoading = true;
        state.assessmentParametersError = null;
      })
      .addCase(getAssessmentParametersAction.fulfilled, (state, action) => {
        state.assessmentParametersLoading = false;
        state.assessmentParameters = action.payload;
        state.assessmentParametersError = null;
      })
      .addCase(getAssessmentParametersAction.rejected, (state, action) => {
        state.assessmentParametersLoading = false;
        state.assessmentParametersError = action.payload;
        state.assessmentParameters = null;
      })

      // Get My Assessments
      .addCase(getMyAssessmentsAction.pending, (state) => {
        state.myAssessmentsLoading = true;
        state.myAssessmentsError = null;
      })
      .addCase(getMyAssessmentsAction.fulfilled, (state, action) => {
        state.myAssessmentsLoading = false;
        state.myAssessments = action.payload;
        state.myAssessmentsError = null;
      })
      .addCase(getMyAssessmentsAction.rejected, (state, action) => {
        state.myAssessmentsLoading = false;
        state.myAssessmentsError = action.payload;
        state.myAssessments = null;
      })

      // Bulk Assign Parameters
      .addCase(bulkAssignParametersAction.pending, (state) => {
        state.bulkAssignParametersLoading = true;
        state.bulkAssignParametersError = null;
      })
      .addCase(bulkAssignParametersAction.fulfilled, (state, action) => {
        state.bulkAssignParametersLoading = false;
        state.bulkAssignParametersData = action.payload;
        state.bulkAssignParametersError = null;
      })
      .addCase(bulkAssignParametersAction.rejected, (state, action) => {
        state.bulkAssignParametersLoading = false;
        state.bulkAssignParametersError = action.payload;
        state.bulkAssignParametersData = null;
      });
  }
});

export const {
  resetAssessmentParametersState,
  resetMyAssessmentsState,
  resetBulkAssignParametersState,
  resetAssessmentParameterSliceState,
  setSelectAllParameter
} = assessmentParameterSlice.actions;

export default assessmentParameterSlice.reducer;
