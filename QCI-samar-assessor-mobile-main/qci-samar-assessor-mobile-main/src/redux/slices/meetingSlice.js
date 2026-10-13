import { createSlice } from '@reduxjs/toolkit';
import {
  addClosingCommentAction,
  addExternalParticipantAction,
  addOpeningCommentAction,
  closingMeetingAction,
  createMeetingAction,
  deleteExternalParticipantAction,
  getClosingMeetingDetailsAction,
  getMeetingDetailsAction,
  updateCommentAction
} from '../action/meetingAction';

const initialState = {
  // Get Meeting Details
  meetingDetailsLoading: false,
  meetingDetailsError: null,
  meetingDetails: null,

  closingMeetingDetailLoading: false,
  closingMeetingDetailError: null,
  closingMeetingDetails: null,

  // Create Meeting
  createMeetingLoading: false,
  createMeetingError: null,
  createMeetingData: null,

  // Add External Participant
  addExternalParticipantLoading: false,
  addExternalParticipantError: null,
  addExternalParticipantData: null,

  // Delete External Participant
  deleteExternalParticipantLoading: false,
  deleteExternalParticipantError: null,
  deleteExternalParticipantData: null,

  // Add Comment
  addOpeningCommentLoading: false,
  addOpeningCommentError: null,
  addOpeningCommentData: null,

  addClosingCommentLoading: false,
  addClosingCommentError: null,
  addClosingCommentData: null,

  closingMeetingLoading: false,
  closingMeetingError: null,
  closingMeetingData: null,

  // Update Comment
  updateCommentLoading: false,
  updateCommentError: null,
  updateCommentData: null
};

const meetingSlice = createSlice({
  name: 'meeting',
  initialState,
  reducers: {
    // Reset individual states
    resetMeetingDetailsState: (state) => {
      state.meetingDetailsLoading = false;
      state.meetingDetailsError = null;
      state.meetingDetails = null;
    },
    resetCreateMeetingState: (state) => {
      state.createMeetingLoading = false;
      state.createMeetingError = null;
      state.createMeetingData = null;
    },
    resetAddExternalParticipantState: (state) => {
      state.addExternalParticipantLoading = false;
      state.addExternalParticipantError = null;
      state.addExternalParticipantData = null;
    },
    resetDeleteExternalParticipantState: (state) => {
      state.deleteExternalParticipantLoading = false;
      state.deleteExternalParticipantError = null;
      state.deleteExternalParticipantData = null;
    },
    resetAddCommentState: (state) => {
      state.addCommentLoading = false;
      state.addCommentError = null;
      state.addCommentData = null;
    },
    resetUpdateCommentState: (state) => {
      state.updateCommentLoading = false;
      state.updateCommentError = null;
      state.updateCommentData = null;
    },
    // Reset entire meeting state
    resetMeetingSliceState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // Get Meeting Details
      .addCase(getMeetingDetailsAction.pending, (state) => {
        state.meetingDetailsLoading = true;
        state.meetingDetailsError = null;
      })
      .addCase(getMeetingDetailsAction.fulfilled, (state, action) => {
        state.meetingDetailsLoading = false;

        const payload = action.payload;
        const teamMembers = payload?.teamMembers || [];
        const meetingParticipants = payload?.meeting?.participants || [];

        // Get external participants (those without teamMemberId)
        const externalParticipants = meetingParticipants
          .filter((p) => !p.teamMemberId && !p.isDefault)
          .map((p) => ({
            id: `external_${p.id}`,
            participantId: p.id,
            user: {
              firstName: p.name?.split(' ')[0] || p.name,
              lastName: p.name?.split(' ').slice(1).join(' ') || ''
            },
            role: p.designation || 'External Participant',
            isExternal: true,
            canRemove: true
          }));

        // Mark team members as non-removable
        const formattedTeamMembers = teamMembers.map((m) => ({
          ...m,
          isExternal: false,
          canRemove: false
        }));

        // Combine both arrays
        state.meetingDetails = {
          ...payload,
          teamMembers: [...formattedTeamMembers, ...externalParticipants]
        };
        state.meetingDetailsError = null;
      })
      .addCase(getMeetingDetailsAction.rejected, (state, action) => {
        state.meetingDetailsLoading = false;
        state.meetingDetailsError = action.payload;
        state.meetingDetails = null;
      })

      .addCase(getClosingMeetingDetailsAction.pending, (state) => {
        state.closingMeetingDetailLoading = true;
        state.closingMeetingDetailError = null;
      })
      .addCase(getClosingMeetingDetailsAction.fulfilled, (state, action) => {
        state.closingMeetingDetailLoading = false;
        const payload = action.payload;
        const teamMembers = payload?.teamMembers || [];
        const meetingParticipants = payload?.meeting?.participants || [];

        // Get external participants (those without teamMemberId)
        const externalParticipants = meetingParticipants
          .filter((p) => !p.teamMemberId && !p.isDefault)
          .map((p) => ({
            id: `external_${p.id}`,
            participantId: p.id,
            user: {
              firstName: p.name?.split(' ')[0] || p.name,
              lastName: p.name?.split(' ').slice(1).join(' ') || ''
            },
            role: p.designation || 'External Participant',
            isExternal: true,
            canRemove: true
          }));

        // Mark team members as non-removable
        const formattedTeamMembers = teamMembers.map((m) => ({
          ...m,
          isExternal: false,
          canRemove: false
        }));

        // Combine both arrays
        state.closingMeetingDetails = {
          ...payload,
          teamMembers: [...formattedTeamMembers, ...externalParticipants]
        };
        state.closingMeetingDetailError = null;
      })
      .addCase(getClosingMeetingDetailsAction.rejected, (state, action) => {
        state.closingMeetingDetailLoading = false;
        state.closingMeetingDetailError = action.payload;
        state.closingMeetingDetails = null;
      })
      // Create Meeting
      .addCase(createMeetingAction.pending, (state) => {
        state.createMeetingLoading = true;
        state.createMeetingError = null;
      })
      .addCase(createMeetingAction.fulfilled, (state, action) => {
        state.createMeetingLoading = false;
        state.createMeetingData = action.payload;
        state.createMeetingError = null;
      })
      .addCase(createMeetingAction.rejected, (state, action) => {
        state.createMeetingLoading = false;
        state.createMeetingError = action.payload;
        state.createMeetingData = null;
      })

      .addCase(closingMeetingAction.pending, (state) => {
        state.closingMeetingLoading = true;
        state.closingMeetingError = null;
      })
      .addCase(closingMeetingAction.fulfilled, (state, action) => {
        state.closingMeetingLoading = false;
        state.closingMeetingData = action.payload;
        state.closingMeetingError = null;
      })
      .addCase(closingMeetingAction.rejected, (state, action) => {
        state.closingMeetingLoading = false;
        state.closingMeetingError = action.payload;
        state.closingMeetingData = null;
      })

      // Add External Participant
      .addCase(addExternalParticipantAction.pending, (state) => {
        state.addExternalParticipantLoading = true;
        state.addExternalParticipantError = null;
      })
      .addCase(addExternalParticipantAction.fulfilled, (state, action) => {
        state.addExternalParticipantLoading = false;
        state.addExternalParticipantData = action.payload;
        state.addExternalParticipantError = null;

        // Add the new external participant to teamMembers array
        const newParticipant = action.payload?.data;
        if (newParticipant && state.meetingDetails) {
          const formattedParticipant = {
            id: `external_${newParticipant.id}`,
            participantId: newParticipant.id,
            user: {
              firstName: newParticipant.name?.split(' ')[0] || newParticipant.name,
              lastName: newParticipant.name?.split(' ').slice(1).join(' ') || ''
            },
            role: newParticipant.designation || 'External Participant',
            isExternal: true,
            canRemove: true
          };
          state.meetingDetails.teamMembers = [
            ...(state.meetingDetails.teamMembers || []),
            formattedParticipant
          ];
        }
      })
      .addCase(addExternalParticipantAction.rejected, (state, action) => {
        state.addExternalParticipantLoading = false;
        state.addExternalParticipantError = action.payload;
        state.addExternalParticipantData = null;
      })

      // Delete External Participant
      .addCase(deleteExternalParticipantAction.pending, (state) => {
        state.deleteExternalParticipantLoading = true;
        state.deleteExternalParticipantError = null;
      })
      .addCase(deleteExternalParticipantAction.fulfilled, (state, action) => {
        state.deleteExternalParticipantLoading = false;
        state.deleteExternalParticipantData = action.payload;
        state.deleteExternalParticipantError = null;

        // Remove the deleted participant from teamMembers array
        const deletedParticipantId = action.meta?.arg?.participantId;
        if (deletedParticipantId && state.meetingDetails?.teamMembers) {
          state.meetingDetails.teamMembers = state.meetingDetails.teamMembers.filter(
            (member) => member.participantId !== deletedParticipantId
          );
        }
      })
      .addCase(deleteExternalParticipantAction.rejected, (state, action) => {
        state.deleteExternalParticipantLoading = false;
        state.deleteExternalParticipantError = action.payload;
        state.deleteExternalParticipantData = null;
      })

      // Add Opening Comment
      .addCase(addOpeningCommentAction.pending, (state) => {
        state.addOpeningCommentLoading = true;
        state.addOpeningCommentError = null;
      })
      .addCase(addOpeningCommentAction.fulfilled, (state, action) => {
        state.addOpeningCommentLoading = false;
        state.addOpeningCommentData = action.payload;
        state.addOpeningCommentError = null;
      })
      .addCase(addOpeningCommentAction.rejected, (state, action) => {
        state.addOpeningCommentLoading = false;
        state.addOpeningCommentError = action.payload;
        state.addOpeningCommentData = null;
      })

      .addCase(addClosingCommentAction.pending, (state) => {
        state.addClosingCommentLoading = true;
        state.addClosingCommentError = null;
      })
      .addCase(addClosingCommentAction.fulfilled, (state, action) => {
        state.addClosingCommentLoading = false;
        state.addClosingCommentData = action.payload;
        state.addClosingCommentError = null;
      })
      .addCase(addClosingCommentAction.rejected, (state, action) => {
        state.addClosingCommentLoading = false;
        state.addClosingCommentError = action.payload;
        state.addClosingCommentData = null;
      })

      // Update Comment
      .addCase(updateCommentAction.pending, (state) => {
        state.updateCommentLoading = true;
        state.updateCommentError = null;
      })
      .addCase(updateCommentAction.fulfilled, (state, action) => {
        state.updateCommentLoading = false;
        state.updateCommentData = action.payload;
        state.updateCommentError = null;
      })
      .addCase(updateCommentAction.rejected, (state, action) => {
        state.updateCommentLoading = false;
        state.updateCommentError = action.payload;
        state.updateCommentData = null;
      });
  }
});

export const {
  resetMeetingDetailsState,
  resetCreateMeetingState,
  resetAddExternalParticipantState,
  resetDeleteExternalParticipantState,
  resetAddCommentState,
  resetUpdateCommentState,
  resetMeetingSliceState
} = meetingSlice.actions;

export default meetingSlice.reducer;
