import { createSlice } from '@reduxjs/toolkit';
import { createSupportTicketAction, getSupportTicketAction, listSupportTicketsAction, updateSupportTicketAction } from '../../action/unitAdmin/SupportAction';

const initialState = {
  // list
  tickets: null,
  listSupportTicketsLoading: false,
  listSupportTicketsError: null,

  // single ticket
  ticketDetails: null,
  getSupportTicketLoading: false,
  getSupportTicketError: null,

  // create
  createSupportTicket: null,
  createSupportTicketLoading: false,
  createSupportTicketError: null,

  // update
  updateSupportTicket: null,
  updateSupportTicketLoading: false,
  updateSupportTicketError: null,
};

const UnitAdminSupportSlice = createSlice({
  name: 'UnitAdminSupport',
  initialState,
  reducers: {
    resetCreateSupportTicket(state) {
      state.createSupportTicket = null;
      state.createSupportTicketLoading = false;
      state.createSupportTicketError = null;
    },
    resetUpdateSupportTicket(state) {
      state.updateSupportTicket = null;
      state.updateSupportTicketLoading = false;
      state.updateSupportTicketError = null;
    },
    resetSupportState(state) {
      Object.assign(state, initialState);
    },
  },
  extraReducers: builder => {
    // list
    builder.addCase(listSupportTicketsAction.pending, state => {
      state.listSupportTicketsLoading = true;
      state.listSupportTicketsError = null;
    });
    builder.addCase(listSupportTicketsAction.fulfilled, (state, action) => {
      state.listSupportTicketsLoading = false;
      state.tickets = action.payload;
    });
    builder.addCase(listSupportTicketsAction.rejected, (state, action) => {
      state.listSupportTicketsLoading = false;
      state.listSupportTicketsError = action.payload || action.error?.message;
    });

    // get
    builder.addCase(getSupportTicketAction.pending, state => {
      state.getSupportTicketLoading = true;
      state.getSupportTicketError = null;
    });
    builder.addCase(getSupportTicketAction.fulfilled, (state, action) => {
      state.getSupportTicketLoading = false;
      state.ticketDetails = action.payload;
    });
    builder.addCase(getSupportTicketAction.rejected, (state, action) => {
      state.getSupportTicketLoading = false;
      state.getSupportTicketError = action.payload || action.error?.message;
    });

    // create
    builder.addCase(createSupportTicketAction.pending, state => {
      state.createSupportTicketLoading = true;
      state.createSupportTicketError = null;
    });
    builder.addCase(createSupportTicketAction.fulfilled, (state, action) => {
      state.createSupportTicketLoading = false;
      state.createSupportTicket = action.payload;
    });
    builder.addCase(createSupportTicketAction.rejected, (state, action) => {
      state.createSupportTicketLoading = false;
      state.createSupportTicketError = action.payload || action.error?.message;
    });

    // update
    builder.addCase(updateSupportTicketAction.pending, state => {
      state.updateSupportTicketLoading = true;
      state.updateSupportTicketError = null;
    });
    builder.addCase(updateSupportTicketAction.fulfilled, (state, action) => {
      state.updateSupportTicketLoading = false;
      state.updateSupportTicket = action.payload;
    });
    builder.addCase(updateSupportTicketAction.rejected, (state, action) => {
      state.updateSupportTicketLoading = false;
      state.updateSupportTicketError = action.payload || action.error?.message;
    });
  },
});

export const { resetCreateSupportTicket, resetUpdateSupportTicket, resetSupportState } = UnitAdminSupportSlice.actions;

export default UnitAdminSupportSlice.reducer;
