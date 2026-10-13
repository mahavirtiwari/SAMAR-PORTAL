import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import {
  createCommitteeMemberAction,
  deleteCommitteeMemberAction,
  getCommitteeMemberAction,
  getCommitteeMembersAction,
  updateCommitteeMemberAction,
} from '../../action/operationsAdmin/CommitteeMemberAction';

const initialState = {
  // List of members
  members: [],
  membersLoading: false,
  membersError: null,
  membersPagination: null,

  // Single member details
  currentMember: null,
  currentMemberLoading: false,
  currentMemberError: null,

  // CRUD operations
  createLoading: false,
  createError: null,
  updateLoading: false,
  updateError: null,
  deleteLoading: false,
  deleteError: null,
};

const committeeMemberSlice = createSlice({
  name: 'CommitteeMember',
  initialState,
  reducers: {
    resetCommitteeMemberState(state) {
      state.membersError = null;
      state.currentMemberError = null;
      state.createError = null;
      state.updateError = null;
      state.deleteError = null;
    },
    clearCommitteeMembers(state) {
      state.members = [];
      state.membersPagination = null;
    },
    clearCurrentMember(state) {
      state.currentMember = null;
      state.currentMemberError = null;
    },
  },
  extraReducers: builder => {
    builder
      // GET all members
      .addCase(getCommitteeMembersAction.pending, state => {
        state.membersLoading = true;
        state.membersError = null;
      })
      .addCase(getCommitteeMembersAction.fulfilled, (state, action) => {
        state.membersLoading = false;
        state.members = action.payload?.members ?? action.payload ?? [];
        state.membersPagination = action.payload?.pagination ?? null;
        Logger.info('Committee members loaded successfully in slice');
      })
      .addCase(getCommitteeMembersAction.rejected, (state, action) => {
        state.membersLoading = false;
        state.membersError = action.payload;
        Logger.error('Get committee members failed in slice:', action.payload);
      })

      // GET single member
      .addCase(getCommitteeMemberAction.pending, state => {
        state.currentMemberLoading = true;
        state.currentMemberError = null;
      })
      .addCase(getCommitteeMemberAction.fulfilled, (state, action) => {
        state.currentMemberLoading = false;
        state.currentMember = action.payload?.member ?? action.payload;
        Logger.info('Committee member loaded successfully in slice');
      })
      .addCase(getCommitteeMemberAction.rejected, (state, action) => {
        state.currentMemberLoading = false;
        state.currentMemberError = action.payload;
        Logger.error('Get committee member failed in slice:', action.payload);
      })

      // CREATE member
      .addCase(createCommitteeMemberAction.pending, state => {
        state.createLoading = true;
        state.createError = null;
      })
      .addCase(createCommitteeMemberAction.fulfilled, (state, action) => {
        state.createLoading = false;
        const newMember = action.payload?.member ?? action.payload;
        if (newMember) {
          state.members.unshift(newMember);
        }
        Logger.info('Committee member created successfully in slice');
      })
      .addCase(createCommitteeMemberAction.rejected, (state, action) => {
        state.createLoading = false;
        state.createError = action.payload;
        Logger.error('Create committee member failed in slice:', action.payload);
      })

      // UPDATE member
      .addCase(updateCommitteeMemberAction.pending, state => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updateCommitteeMemberAction.fulfilled, (state, action) => {
        state.updateLoading = false;
        const updated = action.payload?.member ?? action.payload;
        if (updated && updated.id) {
          const idx = state.members.findIndex(m => String(m.id) === String(updated.id));
          if (idx > -1) {
            state.members[idx] = updated;
          }
        }
        Logger.info('Committee member updated successfully in slice');
      })
      .addCase(updateCommitteeMemberAction.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload;
        Logger.error('Update committee member failed in slice:', action.payload);
      })

      // DELETE member
      .addCase(deleteCommitteeMemberAction.pending, state => {
        state.deleteLoading = true;
        state.deleteError = null;
      })
      .addCase(deleteCommitteeMemberAction.fulfilled, (state, action) => {
        state.deleteLoading = false;
        const memberId = action.payload?.memberId;
        if (memberId) {
          state.members = state.members.filter(m => String(m.id) !== String(memberId));
        }
        Logger.info('Committee member deleted successfully in slice');
      })
      .addCase(deleteCommitteeMemberAction.rejected, (state, action) => {
        state.deleteLoading = false;
        state.deleteError = action.payload;
        Logger.error('Delete committee member failed in slice:', action.payload);
      });
  },
});

export const { resetCommitteeMemberState, clearCommitteeMembers, clearCurrentMember } = committeeMemberSlice.actions;
export default committeeMemberSlice.reducer;
