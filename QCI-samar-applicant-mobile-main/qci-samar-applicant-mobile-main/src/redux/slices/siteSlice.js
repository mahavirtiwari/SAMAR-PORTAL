import { createSlice } from '@reduxjs/toolkit';
import {
  addSitePicture,
  addSiteTourPicture,
  deleteSitePicture,
  deleteSiteTourPicture,
  getSitePictures,
  getSiteTourPictures,
} from '../action/siteAction';

const initialState = {
  // Site pictures (interior/exterior)
  sitePictures: null,
  sitePicturesLoading: false,
  sitePicturesError: null,

  addSitePictureData: null,
  addSitePictureLoading: false,
  addSitePictureError: null,

  deleteSitePictureData: null,
  deleteSitePictureLoading: false,
  deleteSitePictureError: null,

  // Site tour pictures
  siteTourPictures: null,
  siteTourPicturesLoading: false,
  siteTourPicturesError: null,

  addSiteTourPictureData: null,
  addSiteTourPictureLoading: false,
  addSiteTourPictureError: null,

  deleteSiteTourPictureData: null,
  deleteSiteTourPictureLoading: false,
  deleteSiteTourPictureError: null,
};

const SiteSlice = createSlice({
  name: 'site',
  initialState,
  reducers: {
    resetSitePicturesState(state) {
      state.sitePictures = null;
      state.sitePicturesError = null;
    },
    resetAddSitePictureState(state) {
      state.addSitePictureData = null;
      state.addSitePictureError = null;
    },
    resetDeleteSitePictureState(state) {
      state.deleteSitePictureData = null;
      state.deleteSitePictureError = null;
    },
    resetSiteTourPicturesState(state) {
      state.siteTourPictures = null;
      state.siteTourPicturesError = null;
    },
    resetAddSiteTourPictureState(state) {
      state.addSiteTourPictureData = null;
      state.addSiteTourPictureError = null;
    },
    resetDeleteSiteTourPictureState(state) {
      state.deleteSiteTourPictureData = null;
      state.deleteSiteTourPictureError = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(getSitePictures.pending, state => {
        state.sitePicturesLoading = true;
        state.sitePicturesError = null;
      })
      .addCase(getSitePictures.fulfilled, (state, action) => {
        state.sitePicturesLoading = false;
        state.sitePictures = action.payload;
      })
      .addCase(getSitePictures.rejected, (state, action) => {
        state.sitePicturesLoading = false;
        state.sitePicturesError = action.payload || action.error.message;
      });

    builder
      .addCase(addSitePicture.pending, state => {
        state.addSitePictureLoading = true;
        state.addSitePictureError = null;
      })
      .addCase(addSitePicture.fulfilled, (state, action) => {
        state.addSitePictureLoading = false;
        state.addSitePictureData = action.payload;
      })
      .addCase(addSitePicture.rejected, (state, action) => {
        state.addSitePictureLoading = false;
        state.addSitePictureError = action.payload || action.error.message;
      });

    builder
      .addCase(deleteSitePicture.pending, state => {
        state.deleteSitePictureLoading = true;
        state.deleteSitePictureError = null;
      })
      .addCase(deleteSitePicture.fulfilled, (state, action) => {
        state.deleteSitePictureLoading = false;
        state.deleteSitePictureData = action.payload;
      })
      .addCase(deleteSitePicture.rejected, (state, action) => {
        state.deleteSitePictureLoading = false;
        state.deleteSitePictureError = action.payload || action.error.message;
      });

    builder
      .addCase(getSiteTourPictures.pending, state => {
        state.siteTourPicturesLoading = true;
        state.siteTourPicturesError = null;
      })
      .addCase(getSiteTourPictures.fulfilled, (state, action) => {
        state.siteTourPicturesLoading = false;
        state.siteTourPictures = action.payload;
      })
      .addCase(getSiteTourPictures.rejected, (state, action) => {
        state.siteTourPicturesLoading = false;
        state.siteTourPicturesError = action.payload || action.error.message;
      });

    builder
      .addCase(addSiteTourPicture.pending, state => {
        state.addSiteTourPictureLoading = true;
        state.addSiteTourPictureError = null;
      })
      .addCase(addSiteTourPicture.fulfilled, (state, action) => {
        state.addSiteTourPictureLoading = false;
        state.addSiteTourPictureData = action.payload;
      })
      .addCase(addSiteTourPicture.rejected, (state, action) => {
        state.addSiteTourPictureLoading = false;
        state.addSiteTourPictureError = action.payload || action.error.message;
      });

    builder
      .addCase(deleteSiteTourPicture.pending, state => {
        state.deleteSiteTourPictureLoading = true;
        state.deleteSiteTourPictureError = null;
      })
      .addCase(deleteSiteTourPicture.fulfilled, (state, action) => {
        state.deleteSiteTourPictureLoading = false;
        state.deleteSiteTourPictureData = action.payload;
      })
      .addCase(deleteSiteTourPicture.rejected, (state, action) => {
        state.deleteSiteTourPictureLoading = false;
        state.deleteSiteTourPictureError = action.payload || action.error.message;
      });
  },
});

export const {
  resetSitePicturesState,
  resetAddSitePictureState,
  resetDeleteSitePictureState,
  resetSiteTourPicturesState,
  resetAddSiteTourPictureState,
  resetDeleteSiteTourPictureState,
} = SiteSlice.actions;
export default SiteSlice.reducer;
