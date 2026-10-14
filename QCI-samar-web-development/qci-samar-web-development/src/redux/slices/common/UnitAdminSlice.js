import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import {
  activateUserAccountAction,
  createUserAction,
  createUserAssessorDistrictsAction,
  createUserDomainsAction,
  deactivateUserAccountAction,
  getAllUsersAction,
  getLoggedInUserDetailsAction,
  getUserDetailsAction,
  updateUserAction,
  updateUserAssessorDistrictsAction,
  updateUserDomainsAction,
} from '../../action/common/UnitAdminAction';

const initialState = {
  userList: [],
  userListLoading: true,
  userListError: null,

  createUser: null,
  createUserLoading: false,
  createUserError: null,

  userDetailsLoading: false,
  userDetailsError: null,
  userDetails: null,

  // Separate state for logged-in user's profile (used by Header)
  loggedInUserDetails: null,
  loggedInUserDetailsLoading: false,
  loggedInUserDetailsError: null,

  userAccountActivate: null,
  userAccountActivateLoading: false,
  userAccountActivateError: null,

  userAccountDeactivate: null,
  userAccountDeactivateLoading: false,
  userAccountDeactivateError: null,
  updateUser: null,
  updateUserLoading: false,
  updateUserError: null,

  updateUserDomainsLoading: false,
  updateUserDomainsError: null,
  updateUserDomains: null,

  createUserDomainsLoading: false,
  createUserDomainsError: null,
  createUserDomains: null,

  createUserAssessorDistrictsLoading: false,
  createUserAssessorDistrictsError: null,
  createUserAssessorDistricts: null,

  updateUserAssessorDistrictsLoading: false,
  updateUserAssessorDistrictsError: null,
  updateUserAssessorDistricts: null,
};

const unitAdminSlice = createSlice({
  name: 'unitAdmins',
  initialState,
  reducers: {
    resetCreateUpdateUser: state => {
      state.createUser = null;
      state.createUserError = null;
      state.createUserLoading = false;
      state.updateUser = null;
      state.updateUserError = null;
      state.updateUserLoading = false;
    },
    resetUserDetails: state => {
      state.userDetails = null;
      state.userDetailsError = null;
      state.userDetailsLoading = false;
    },
  },
  extraReducers: builder => {
    // Get all unit admins
    builder
      .addCase(getAllUsersAction.pending, state => {
        state.userListLoading = true;
        state.userListError = null;
      })
      .addCase(getAllUsersAction.fulfilled, (state, action) => {
        state.userListLoading = false;
        state.userList = action.payload;
        Logger.info('Users loaded successfully in slice');
      })
      .addCase(getAllUsersAction.rejected, (state, action) => {
        // Superseded by a newer search/page request, which owns the loading flag.
        if (action.meta.aborted) {
          return;
        }
        state.userListLoading = false;
        state.userListError = action.payload;
        Logger.error('Get users failed in slice:', action.payload);
      });

    builder
      .addCase(updateUserAction.pending, state => {
        state.updateUserLoading = true;
        state.updateUserError = null;
      })
      .addCase(updateUserAction.fulfilled, (state, action) => {
        state.updateUserLoading = false;
        state.updateUser = action.payload || null;
        Logger.info('User updated successfully in slice');
      })
      .addCase(updateUserAction.rejected, (state, action) => {
        state.updateUserLoading = false;
        state.updateUserError = action.payload;
        Logger.error('Update user failed in slice:', action.payload);
      });
    //   create new user
    builder
      .addCase(createUserAction.pending, state => {
        state.createUserLoading = true;
        state.createUserError = null;
      })
      .addCase(createUserAction.fulfilled, (state, action) => {
        state.createUserLoading = false;
        state.createUser = action.payload?.data;
        Logger.info('User created successfully in slice');
      })
      .addCase(createUserAction.rejected, (state, action) => {
        state.createUserLoading = false;
        state.createUserError = action.payload;
        Logger.error('Create user failed in slice:', action.payload);
      });

    //   get user details
    builder
      .addCase(getUserDetailsAction.pending, state => {
        state.userDetailsLoading = true;
        state.userDetailsError = null;
      })
      .addCase(getUserDetailsAction.fulfilled, (state, action) => {
        state.userDetailsLoading = false;
        state.userDetails = action.payload;
        Logger.info('User details loaded successfully in slice');
      })
      .addCase(getUserDetailsAction.rejected, (state, action) => {
        state.userDetailsLoading = false;
        state.userDetailsError = action.payload;
        Logger.error('Get user details failed in slice:', action.payload);
      });

    //   get logged-in user details (for Header profile display)
    builder
      .addCase(getLoggedInUserDetailsAction.pending, state => {
        state.loggedInUserDetailsLoading = true;
        state.loggedInUserDetailsError = null;
      })
      .addCase(getLoggedInUserDetailsAction.fulfilled, (state, action) => {
        state.loggedInUserDetailsLoading = false;
        state.loggedInUserDetails = action.payload;
        Logger.info('Logged-in user details loaded successfully in slice');
      })
      .addCase(getLoggedInUserDetailsAction.rejected, (state, action) => {
        state.loggedInUserDetailsLoading = false;
        state.loggedInUserDetailsError = action.payload;
        Logger.error('Get logged-in user details failed in slice:', action.payload);
      });

    //   activate user account
    builder
      .addCase(activateUserAccountAction.pending, state => {
        state.userAccountActivateLoading = true;
        state.userAccountActivateError = null;
      })
      .addCase(activateUserAccountAction.fulfilled, (state, action) => {
        state.userAccountActivateLoading = false;
        state.userAccountActivate = action.payload?.data || action.payload;
        Logger.info('User activated successfully in slice');
      })
      .addCase(activateUserAccountAction.rejected, (state, action) => {
        state.userAccountActivateLoading = false;
        state.userAccountActivateError = action.payload;
        Logger.error('Activate user failed in slice:', action.payload);
      });

    //   deactivate user account
    builder
      .addCase(deactivateUserAccountAction.pending, state => {
        state.userAccountDeactivateLoading = true;
        state.userAccountDeactivateError = null;
      })
      .addCase(deactivateUserAccountAction.fulfilled, (state, action) => {
        state.userAccountDeactivateLoading = false;
        state.userAccountDeactivate = action.payload?.data || action.payload;
        Logger.info('User deactivated successfully in slice');
      })
      .addCase(deactivateUserAccountAction.rejected, (state, action) => {
        state.userAccountDeactivateLoading = false;
        state.userAccountDeactivateError = action.payload;
        Logger.error('Deactivate user failed in slice:', action.payload);
      });

    // Update user domains (POST)
    builder
      .addCase(updateUserDomainsAction.pending, state => {
        state.updateUserDomainsLoading = true;
        state.updateUserDomainsError = null;
      })
      .addCase(updateUserDomainsAction.fulfilled, (state, action) => {
        state.updateUserDomainsLoading = false;
        state.updateUserDomains = action.payload?.data || action.payload;
        Logger.info('User domains updated successfully in slice');
      })
      .addCase(updateUserDomainsAction.rejected, (state, action) => {
        state.updateUserDomainsLoading = false;
        state.updateUserDomainsError = action.payload;
        Logger.error('Update user domains failed in slice:', action.payload);
      });

    // Put user domains (PUT)
    builder
      .addCase(createUserDomainsAction.pending, state => {
        state.createUserDomainsLoading = true;
        state.createUserDomainsError = null;
      })
      .addCase(createUserDomainsAction.fulfilled, (state, action) => {
        state.createUserDomainsLoading = false;
        state.createUserDomains = action.payload?.data || action.payload;
        Logger.info('User domains put successfully in slice');
      })
      .addCase(createUserDomainsAction.rejected, (state, action) => {
        state.createUserDomainsLoading = false;
        state.createUserDomainsError = action.payload;
        Logger.error('Put user domains failed in slice:', action.payload);
      });

    // Create user assessor districts
    builder
      .addCase(createUserAssessorDistrictsAction.pending, state => {
        state.createUserAssessorDistrictsLoading = true;
        state.createUserAssessorDistrictsError = null;
      })
      .addCase(createUserAssessorDistrictsAction.fulfilled, (state, action) => {
        state.createUserAssessorDistrictsLoading = false;
        state.createUserAssessorDistricts = action.payload?.data || action.payload;
        Logger.info('User assessor districts created successfully in slice');
      })
      .addCase(createUserAssessorDistrictsAction.rejected, (state, action) => {
        state.createUserAssessorDistrictsLoading = false;
        state.createUserAssessorDistrictsError = action.payload;
        Logger.error('Create user assessor districts failed in slice:', action.payload);
      });

    // Update user assessor districts
    builder
      .addCase(updateUserAssessorDistrictsAction.pending, state => {
        state.updateUserAssessorDistrictsLoading = true;
        state.updateUserAssessorDistrictsError = null;
      })
      .addCase(updateUserAssessorDistrictsAction.fulfilled, (state, action) => {
        state.updateUserAssessorDistrictsLoading = false;
        state.updateUserAssessorDistricts = action.payload?.data || action.payload;
        Logger.info('User assessor districts updated successfully in slice');
      })
      .addCase(updateUserAssessorDistrictsAction.rejected, (state, action) => {
        state.updateUserAssessorDistrictsLoading = false;
        state.updateUserAssessorDistrictsError = action.payload;
        Logger.error('Update user assessor districts failed in slice:', action.payload);
      });
  },
});
export const { resetCreateUpdateUser, resetUserDetails } = unitAdminSlice.actions;
export default unitAdminSlice.reducer;
