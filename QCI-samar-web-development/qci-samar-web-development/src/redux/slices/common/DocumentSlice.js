import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import { activateDocumentAction, deactivateDocumentAction, downloadDocumentAction, getDocumentsAction, uploadDocumentAction } from '../../action/common/DocumentAction';

const initialState = {
  documents: [],
  documentsLoading: false,
  documentsError: null,

  document: null,
  documentLoading: false,
  documentError: null,

  createLoading: false,
  createError: null,
  createdDocument: null,

  updateLoading: false,
  updateError: null,
  updatedDocument: null,

  deleteLoading: false,
  deleteError: null,
  deletedDocument: null,

  uploadLoading: false,
  uploadError: null,
  uploadedDocument: null,

  downloadLoading: false,
  downloadError: null,
  downloadedDocument: null,

  activateLoading: false,
  activateError: null,
  activatedDocument: null,

  deactivateLoading: false,
  deactivateError: null,
  deactivatedDocument: null,
};

const documentSlice = createSlice({
  name: 'document',
  initialState,
  reducers: {
    resetDocumentCreateUpdateDelete(state) {
      state.createLoading = false;
      state.createError = null;
      state.createdDocument = null;
      state.updateLoading = false;
      state.updateError = null;
      state.updatedDocument = null;
      state.deleteLoading = false;
      state.deleteError = null;
      state.deletedDocument = null;
      state.uploadLoading = false;
      state.uploadError = null;
      state.uploadedDocument = null;
      state.downloadLoading = false;
      state.downloadError = null;
      state.downloadedDocument = null;
      state.activateLoading = false;
      state.activateError = null;
      state.activatedDocument = null;
      state.deactivateLoading = false;
      state.deactivateError = null;
      state.deactivatedDocument = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(getDocumentsAction.pending, state => {
        state.documentsLoading = true;
        state.documentsError = null;
      })
      .addCase(getDocumentsAction.fulfilled, (state, action) => {
        state.documentsLoading = false;
        state.documents = action.payload || [];
        Logger.info('Documents loaded successfully in slice');
      })
      .addCase(getDocumentsAction.rejected, (state, action) => {
        state.documentsLoading = false;
        state.documentsError = action.payload;
        Logger.error('Get documents failed in slice:', action.payload);
      });

    builder
      .addCase(uploadDocumentAction.pending, state => {
        state.uploadLoading = true;
        state.uploadError = null;
      })
      .addCase(uploadDocumentAction.fulfilled, (state, action) => {
        state.uploadLoading = false;
        state.uploadedDocument = action.payload || null;
        Logger.info('Document uploaded successfully in slice');
      })
      .addCase(uploadDocumentAction.rejected, (state, action) => {
        state.uploadLoading = false;
        state.uploadError = action.payload;
        Logger.error('Upload document failed in slice:', action.payload);
      });

    builder
      .addCase(downloadDocumentAction.pending, state => {
        state.downloadLoading = true;
        state.downloadError = null;
      })
      .addCase(downloadDocumentAction.fulfilled, (state, action) => {
        state.downloadLoading = false;
        state.downloadedDocument = action.payload || null;
        Logger.info('Document downloaded successfully in slice');
      })
      .addCase(downloadDocumentAction.rejected, (state, action) => {
        state.downloadLoading = false;
        state.downloadError = action.payload;
        Logger.error('Download document failed in slice:', action.payload);
      });

    builder
      .addCase(activateDocumentAction.pending, state => {
        state.activateLoading = true;
        state.activateError = null;
      })
      .addCase(activateDocumentAction.fulfilled, (state, action) => {
        state.activateLoading = false;
        state.activatedDocument = action.payload || null;
        Logger.info('Document activated successfully in slice');
      })
      .addCase(activateDocumentAction.rejected, (state, action) => {
        state.activateLoading = false;
        state.activateError = action.payload;
        Logger.error('Activate document failed in slice:', action.payload);
      });

    builder
      .addCase(deactivateDocumentAction.pending, state => {
        state.deactivateLoading = true;
        state.deactivateError = null;
      })
      .addCase(deactivateDocumentAction.fulfilled, (state, action) => {
        state.deactivateLoading = false;
        state.deactivatedDocument = action.payload || null;
        Logger.info('Document deactivated successfully in slice');
      })
      .addCase(deactivateDocumentAction.rejected, (state, action) => {
        state.deactivateLoading = false;
        state.deactivateError = action.payload;
        Logger.error('Deactivate document failed in slice:', action.payload);
      });
  },
});

export const { resetDocumentCreateUpdateDelete } = documentSlice.actions;
export default documentSlice.reducer;
