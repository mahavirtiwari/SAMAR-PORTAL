import { createSlice } from '@reduxjs/toolkit';
import { downloadCertificateDocumentAction, getCertificateByIdAction, getCertificatesAction } from '../../action/unitAdmin/CertificateAction';

const initialState = {
  // Certificates list
  certificates: {
    data: [],
    pagination: null,
  },
  certificatesLoading: false,
  certificatesError: null,

  // Single certificate details
  certificateDetails: null,
  certificateDetailsLoading: false,
  certificateDetailsError: null,

  // Download state
  downloadLoading: false,
  downloadError: null,
};

const UnitAdminCertificateSlice = createSlice({
  name: 'UnitAdminCertificate',
  initialState,
  reducers: {
    resetCertificates: state => {
      state.certificates = { data: [], pagination: null };
      state.certificatesError = null;
    },
    resetCertificateDetails: state => {
      state.certificateDetails = null;
      state.certificateDetailsError = null;
    },
    clearCertificateErrors: state => {
      state.certificatesError = null;
      state.certificateDetailsError = null;
      state.downloadError = null;
    },
  },
  extraReducers: builder => {
    builder
      // Get certificates list
      .addCase(getCertificatesAction.pending, state => {
        state.certificatesLoading = true;
        state.certificatesError = null;
      })
      .addCase(getCertificatesAction.fulfilled, (state, action) => {
        state.certificatesLoading = false;
        state.certificates = {
          data: action.payload?.data || [],
          pagination: action.payload?.pagination || null,
        };
      })
      .addCase(getCertificatesAction.rejected, (state, action) => {
        // Superseded by a newer search/page request, which owns the loading flag.
        if (action.meta.aborted) {
          return;
        }
        state.certificatesLoading = false;
        state.certificatesError = action.payload;
      })

      // Get certificate by ID
      .addCase(getCertificateByIdAction.pending, state => {
        state.certificateDetailsLoading = true;
        state.certificateDetailsError = null;
      })
      .addCase(getCertificateByIdAction.fulfilled, (state, action) => {
        state.certificateDetailsLoading = false;
        state.certificateDetails = action.payload;
      })
      .addCase(getCertificateByIdAction.rejected, (state, action) => {
        state.certificateDetailsLoading = false;
        state.certificateDetailsError = action.payload;
      })

      // Download document
      .addCase(downloadCertificateDocumentAction.pending, state => {
        state.downloadLoading = true;
        state.downloadError = null;
      })
      .addCase(downloadCertificateDocumentAction.fulfilled, state => {
        state.downloadLoading = false;
      })
      .addCase(downloadCertificateDocumentAction.rejected, (state, action) => {
        state.downloadLoading = false;
        state.downloadError = action.payload;
      });
  },
});

export const { resetCertificates, resetCertificateDetails, clearCertificateErrors } = UnitAdminCertificateSlice.actions;

export default UnitAdminCertificateSlice.reducer;
