import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../../utils/logger';
import { getUserDetailsAction } from '../../../action/common/UnitAdminAction';
import {
  autosaveManufacturingApplicationAction,
  createManufacturingApplicationAction,
  createServiceApplicationAction,
  deleteApplicationAction,
  executeWorkflowTransitionAction,
  getApplicationAction,
  getApplicationDetailsAction,
  getAssessmentSummaryAction,
  submitApplicationForReviewAction,
  submitManufacturingApplicationAction,
  submitServiceApplicationAction,
  updateContactPersonAction,
} from '../../../action/enterpriseAdmin/application/ApplicationAction';

const initialState = {
  applicationList: [],
  applicationListLoading: true,
  applicationListError: null,

  createServiceApplication: null,
  createServiceApplicationLoading: false,
  createServiceApplicationError: null,

  createManufacturingApplication: null,
  createManufacturingApplicationLoading: false,
  createManufacturingApplicationError: null,

  // Background per-field autosave (separate flag so the Save button is untouched)
  autosaveManufacturingApplicationLoading: false,

  applicationDetailsLoading: false,
  applicationDetailsError: null,
  applicationDetails: null,

  updateContactPersonLoading: false,
  updateContactPersonError: null,
  updateContactPerson: null,

  applicationDeleteError: null,
  applicationDeleteLoading: false,
  applicationDelete: null,

  submitApplicationForReviewLoading: false,
  submitApplicationForReviewError: null,
  submitApplicationForReview: null,

  availableWorkflowTransitionsLoading: false,
  availableWorkflowTransitionsError: null,
  availableWorkflowTransitions: null,

  executeWorkflowTransition: null,
  executeWorkflowTransitionLoading: false,
  executeWorkflowTransitionError: null,

  submitManufacturingApplication: null,
  submitManufacturingApplicationLoading: false,
  submitManufacturingApplicationError: null,

  submitServiceApplication: null,
  submitServiceApplicationLoading: false,
  submitServiceApplicationError: null,

  assessmentSummary: null,
  assessmentSummaryLoading: false,
  assessmentSummaryError: null,
};

const applicationSlice = createSlice({
  name: 'application',
  initialState,

  reducers: {
    resetApplicationDetails: state => {
      state.applicationDetails = null;
      state.applicationDetailsError = null;
      state.applicationDetailsLoading = false;
    },
    resetSubmitManufacturingApplication: state => {
      state.submitManufacturingApplication = null;
      state.submitManufacturingApplicationError = null;
      state.submitManufacturingApplicationLoading = false;
    },
    resetSubmitServiceApplication: state => {
      state.submitServiceApplication = null;
      state.submitServiceApplicationError = null;
      state.submitServiceApplicationLoading = false;
    },
    resetCreateServiceApplication: state => {
      state.createServiceApplication = null;
      state.createServiceApplicationError = null;
      state.createServiceApplicationLoading = false;
    },
    resetCreateManufacturingApplication: state => {
      state.createManufacturingApplication = null;
      state.createManufacturingApplicationError = null;
      state.createManufacturingApplicationLoading = false;
    },
    resetAssessmentSummary: state => {
      state.assessmentSummary = null;
      state.assessmentSummaryError = null;
      state.assessmentSummaryLoading = false;
    },
  },
  extraReducers: builder => {
    // Get all applications
    builder
      .addCase(getApplicationAction.pending, state => {
        state.applicationListLoading = true;
        state.applicationListError = null;
      })
      .addCase(getApplicationAction.fulfilled, (state, action) => {
        state.applicationListLoading = false;
        state.applicationList = action.payload || [];
        Logger.info('Applications loaded successfully in slice');
      })
      .addCase(getApplicationAction.rejected, (state, action) => {
        state.applicationListLoading = false;
        state.applicationListError = action.payload;
        Logger.error('Get applications failed in slice:', action.payload);
      });

    //   create new service application
    builder
      .addCase(createServiceApplicationAction.pending, state => {
        state.createServiceApplicationLoading = true;
        state.createServiceApplicationError = null;
      })
      .addCase(createServiceApplicationAction.fulfilled, (state, action) => {
        state.createServiceApplicationLoading = false;
        state.createServiceApplication = action.payload?.data;
        Logger.info('Application created successfully in slice');
      })
      .addCase(createServiceApplicationAction.rejected, (state, action) => {
        state.createServiceApplicationLoading = false;
        state.createServiceApplicationError = action.payload;
        Logger.error('Create application failed in slice:', action.payload);
      });

    //   create new manufacturing application
    builder
      .addCase(createManufacturingApplicationAction.pending, state => {
        state.createManufacturingApplicationLoading = true;
        state.createManufacturingApplicationError = null;
      })
      .addCase(createManufacturingApplicationAction.fulfilled, (state, action) => {
        state.createManufacturingApplicationLoading = false;
        state.createManufacturingApplication = action.payload?.data;
        Logger.info('Application created successfully in slice');
      })
      .addCase(createManufacturingApplicationAction.rejected, (state, action) => {
        state.createManufacturingApplicationLoading = false;
        state.createManufacturingApplicationError = action.payload;
        Logger.error('Create application failed in slice:', action.payload);
      });
    //   background autosave (stores the draft id into the same field so the
    //   wizard keeps tracking the application id, but on a separate loading flag)
    builder
      .addCase(autosaveManufacturingApplicationAction.pending, state => {
        state.autosaveManufacturingApplicationLoading = true;
      })
      .addCase(autosaveManufacturingApplicationAction.fulfilled, (state, action) => {
        state.autosaveManufacturingApplicationLoading = false;
        if (action.payload?.data) {
          state.createManufacturingApplication = action.payload.data;
        }
      })
      .addCase(autosaveManufacturingApplicationAction.rejected, state => {
        state.autosaveManufacturingApplicationLoading = false;
      });

    //   get application details
    builder
      .addCase(getApplicationDetailsAction.pending, state => {
        state.applicationDetailsLoading = true;
        state.applicationDetailsError = null;
      })
      .addCase(getApplicationDetailsAction.fulfilled, (state, action) => {
        state.applicationDetailsLoading = false;
        state.applicationDetails = action.payload?.data || action.payload;
        Logger.info('Application details loaded successfully in slice');
      })
      .addCase(getApplicationDetailsAction.rejected, (state, action) => {
        state.applicationDetailsLoading = false;
        state.applicationDetailsError = action.payload;
        Logger.error('Get application details failed in slice:', action.payload);
      });

    //   submit manufacturing application
    builder
      .addCase(submitManufacturingApplicationAction.pending, state => {
        state.submitManufacturingApplicationLoading = true;
        state.submitManufacturingApplicationError = null;
      })
      .addCase(submitManufacturingApplicationAction.fulfilled, (state, action) => {
        state.submitManufacturingApplicationLoading = false;
        state.submitManufacturingApplication = action.payload;
        Logger.info('Manufacturing application submitted successfully in slice');
      })
      .addCase(submitManufacturingApplicationAction.rejected, (state, action) => {
        state.submitManufacturingApplicationLoading = false;
        state.submitManufacturingApplicationError = action.payload;
        Logger.error('Submit manufacturing application failed in slice:', action.payload);
      });

    //   submit service application
    builder
      .addCase(submitServiceApplicationAction.pending, state => {
        state.submitServiceApplicationLoading = true;
        state.submitServiceApplicationError = null;
      })
      .addCase(submitServiceApplicationAction.fulfilled, (state, action) => {
        state.submitServiceApplicationLoading = false;
        state.submitServiceApplication = action.payload;
        Logger.info('Service application submitted successfully in slice');
      })
      .addCase(submitServiceApplicationAction.rejected, (state, action) => {
        state.submitServiceApplicationLoading = false;
        state.submitServiceApplicationError = action.payload;
        Logger.error('Submit service application failed in slice:', action.payload);
      });

    //   update contact person
    builder
      .addCase(updateContactPersonAction.pending, state => {
        state.updateContactPersonLoading = true;
        state.updateContactPersonError = null;
      })
      .addCase(updateContactPersonAction.fulfilled, (state, action) => {
        state.updateContactPersonLoading = false;
        const updatedData = action.payload?.data || action.payload;
        state.updateContactPerson = updatedData;
        if (state.applicationDetails && updatedData) {
          state.applicationDetails = { ...state.applicationDetails, ...updatedData };
        }
        Logger.info('Contact person updated successfully in slice');
      })
      .addCase(updateContactPersonAction.rejected, (state, action) => {
        state.updateContactPersonLoading = false;
        state.updateContactPersonError = action.payload;
        Logger.error('Update contact person failed in slice:', action.payload);
      });

    //   delete application
    builder
      .addCase(deleteApplicationAction.pending, state => {
        state.applicationDeleteLoading = true;
        state.applicationDeleteError = null;
      })
      .addCase(deleteApplicationAction.fulfilled, (state, action) => {
        state.applicationDeleteLoading = false;
        state.applicationDelete = action.payload?.data || action.payload;
        Logger.info('Application deleted successfully in slice');
      })
      .addCase(deleteApplicationAction.rejected, (state, action) => {
        state.applicationDeleteLoading = false;
        state.applicationDeleteError = action.payload;
        Logger.error('Delete application failed in slice:', action.payload);
      });

    //   submit application for review
    builder
      .addCase(submitApplicationForReviewAction.pending, state => {
        state.submitApplicationForReviewLoading = true;
        state.submitApplicationForReviewError = null;
      })
      .addCase(submitApplicationForReviewAction.fulfilled, (state, action) => {
        state.submitApplicationForReviewLoading = false;
        state.submitApplicationForReview = action.payload?.data || action.payload;
        Logger.info('Application submitted for review successfully in slice');
      })
      .addCase(submitApplicationForReviewAction.rejected, (state, action) => {
        state.submitApplicationForReviewLoading = false;
        state.submitApplicationForReviewError = action.payload;
        Logger.error('Submit application for review failed in slice:', action.payload);
      });

    //   get available workflow transitions

    //execute workflow transition
    builder
      .addCase(executeWorkflowTransitionAction.pending, state => {
        state.executeWorkflowTransitionLoading = true;
        state.executeWorkflowTransitionError = null;
      })
      .addCase(executeWorkflowTransitionAction.fulfilled, (state, action) => {
        state.executeWorkflowTransitionLoading = false;
        state.executeWorkflowTransition = action.payload?.data || action.payload;
        Logger.info('Workflow transition executed successfully in slice');
      })
      .addCase(executeWorkflowTransitionAction.rejected, (state, action) => {
        state.executeWorkflowTransitionLoading = false;
        state.executeWorkflowTransitionError = action.payload;
        Logger.error('Execute workflow transition failed in slice:', action.payload);
      });

    // get assessment summary
    builder
      .addCase(getAssessmentSummaryAction.pending, state => {
        state.assessmentSummaryLoading = true;
        state.assessmentSummaryError = null;
      })
      .addCase(getAssessmentSummaryAction.fulfilled, (state, action) => {
        state.assessmentSummaryLoading = false;
        state.assessmentSummary = action.payload;
        Logger.info('Assessment summary loaded successfully in slice');
      })
      .addCase(getAssessmentSummaryAction.rejected, (state, action) => {
        state.assessmentSummaryLoading = false;
        state.assessmentSummaryError = action.payload;
        Logger.error('Get assessment summary failed in slice:', action.payload);
      });

    builder
      .addCase(getUserDetailsAction.pending, state => {
        state.userDetailsLoading = true;
        state.userDetailsError = null;
      })
      .addCase(getUserDetailsAction.fulfilled, (state, action) => {
        state.userDetailsLoading = false;
        state.userDetails = action.payload?.data || action.payload;
        Logger.info('User details loaded successfully in slice');
      })
      .addCase(getUserDetailsAction.rejected, (state, action) => {
        state.userDetailsLoading = false;
        state.userDetailsError = action.payload;
        Logger.error('Get user details failed in slice:', action.payload);
      });
  },
});
export const {
  resetApplicationDetails,
  resetSubmitManufacturingApplication,
  resetSubmitServiceApplication,
  resetCreateServiceApplication,
  resetCreateManufacturingApplication,
  resetAssessmentSummary,
} = applicationSlice.actions;
export default applicationSlice.reducer;
