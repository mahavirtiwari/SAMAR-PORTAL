import { createSlice } from '@reduxjs/toolkit';
import {
  addSitePictureAction,
  addSiteTourPictureAction,
  deleteSitePictureAction,
  deleteSiteTourPictureAction,
  getMySitePicturesAction,
  getSitePictureAction,
  getSitePicturePoolAction,
  getSiteTourPicturePoolAction,
  getSiteTourPicturesAction
} from '../action/siteAction';

const initialState = {
  // Get Site Picture
  sitePictureLoading: false,
  sitePictureError: null,
  sitePictures: null,

  // Add Site Picture
  addSitePictureLoading: false,
  addSitePictureError: null,
  addSitePictureData: null,

  // Get My Site Pictures
  mySitePicturesLoading: false,
  mySitePicturesError: null,
  mySitePictures: null,

  // Delete Site Picture
  deleteSitePictureLoading: false,
  deleteSitePictureError: null,
  deleteSitePictureData: null,

  // Get Site Tour Pictures
  siteTourPicturesLoading: false,
  siteTourPicturesError: null,
  siteTourPictures: null,

  // Add Site Tour Picture
  addSiteTourPictureLoading: false,
  addSiteTourPictureError: null,
  addSiteTourPictureData: null,

  // Delete Site Tour Picture
  deleteSiteTourPictureLoading: false,
  deleteSiteTourPictureError: null,
  deleteSiteTourPictureData: null
};

const siteSlice = createSlice({
  name: 'site',
  initialState,
  reducers: {
    // Reset individual states
    resetSitePictureState: (state) => {
      state.sitePictureLoading = false;
      state.sitePictureError = null;
      state.sitePictures = null;
    },
    resetAddSitePictureState: (state) => {
      state.addSitePictureLoading = false;
      state.addSitePictureError = null;
      state.addSitePictureData = null;
    },
    resetMySitePicturesState: (state) => {
      state.mySitePicturesLoading = false;
      state.mySitePicturesError = null;
      state.mySitePictures = null;
    },
    resetDeleteSitePictureState: (state) => {
      state.deleteSitePictureLoading = false;
      state.deleteSitePictureError = null;
      state.deleteSitePictureData = null;
    },
    resetSiteTourPicturesState: (state) => {
      state.siteTourPicturesLoading = false;
      state.siteTourPicturesError = null;
      state.siteTourPictures = null;
    },
    resetAddSiteTourPictureState: (state) => {
      state.addSiteTourPictureLoading = false;
      state.addSiteTourPictureError = null;
      state.addSiteTourPictureData = null;
    },
    resetDeleteSiteTourPictureState: (state) => {
      state.deleteSiteTourPictureLoading = false;
      state.deleteSiteTourPictureError = null;
      state.deleteSiteTourPictureData = null;
    },
    // Reset entire site state
    resetSiteSliceState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // Get Site Picture
      .addCase(getSitePictureAction.pending, (state) => {
        state.sitePictureLoading = true;
        state.sitePictureError = null;
      })
      .addCase(getSitePictureAction.fulfilled, (state, action) => {
        state.sitePictureLoading = false;
        state.sitePictures = action.payload;
        state.sitePictureError = null;
      })
      .addCase(getSitePictureAction.rejected, (state, action) => {
        state.sitePictureLoading = false;
        state.sitePictureError = action.payload;
        state.sitePictures = null;
      })

      // Add Site Picture
      .addCase(addSitePictureAction.pending, (state) => {
        state.addSitePictureLoading = true;
        state.addSitePictureError = null;
      })
      .addCase(addSitePictureAction.fulfilled, (state, action) => {
        state.addSitePictureLoading = false;
        state.addSitePictureData = action.payload;
        state.addSitePictureError = null;
      })
      .addCase(addSitePictureAction.rejected, (state, action) => {
        state.addSitePictureLoading = false;
        state.addSitePictureError = action.payload;
        state.addSitePictureData = null;
      })

      // Get My Site Pictures
      .addCase(getMySitePicturesAction.pending, (state) => {
        state.mySitePicturesLoading = true;
        state.mySitePicturesError = null;
      })
      .addCase(getMySitePicturesAction.fulfilled, (state, action) => {
        state.mySitePicturesLoading = false;
        state.mySitePictures = action.payload;
        state.mySitePicturesError = null;
      })
      .addCase(getMySitePicturesAction.rejected, (state, action) => {
        state.mySitePicturesLoading = false;
        state.mySitePicturesError = action.payload;
        state.mySitePictures = null;
      })

      // Get Site Picture Pool (service sector) — reuses the sitePictures slot
      .addCase(getSitePicturePoolAction.pending, (state) => {
        state.sitePictureLoading = true;
        state.sitePictureError = null;
      })
      .addCase(getSitePicturePoolAction.fulfilled, (state, action) => {
        state.sitePictureLoading = false;
        state.sitePictures = action.payload;
        state.sitePictureError = null;
      })
      .addCase(getSitePicturePoolAction.rejected, (state, action) => {
        state.sitePictureLoading = false;
        state.sitePictureError = action.payload;
        state.sitePictures = null;
      })

      // Delete Site Picture
      .addCase(deleteSitePictureAction.pending, (state) => {
        state.deleteSitePictureLoading = true;
        state.deleteSitePictureError = null;
      })
      .addCase(deleteSitePictureAction.fulfilled, (state, action) => {
        state.deleteSitePictureLoading = false;
        state.deleteSitePictureData = action.payload;
        state.deleteSitePictureError = null;
      })
      .addCase(deleteSitePictureAction.rejected, (state, action) => {
        state.deleteSitePictureLoading = false;
        state.deleteSitePictureError = action.payload;
        state.deleteSitePictureData = null;
      })

      // Get Site Tour Pictures
      .addCase(getSiteTourPicturesAction.pending, (state) => {
        state.siteTourPicturesLoading = true;
        state.siteTourPicturesError = null;
      })
      .addCase(getSiteTourPicturesAction.fulfilled, (state, action) => {
        state.siteTourPicturesLoading = false;
        state.siteTourPictures = action.payload;
        state.siteTourPicturesError = null;
      })
      .addCase(getSiteTourPicturesAction.rejected, (state, action) => {
        state.siteTourPicturesLoading = false;
        state.siteTourPicturesError = action.payload;
        state.siteTourPictures = null;
      })

      // Add Site Tour Picture
      .addCase(addSiteTourPictureAction.pending, (state) => {
        state.addSiteTourPictureLoading = true;
        state.addSiteTourPictureError = null;
      })
      .addCase(addSiteTourPictureAction.fulfilled, (state, action) => {
        state.addSiteTourPictureLoading = false;
        state.addSiteTourPictureData = action.payload;
        state.addSiteTourPictureError = null;
      })
      .addCase(addSiteTourPictureAction.rejected, (state, action) => {
        state.addSiteTourPictureLoading = false;
        state.addSiteTourPictureError = action.payload;
        state.addSiteTourPictureData = null;
      })

      // Get Site Tour Picture Pool (service sector) — reuses siteTourPictures slot
      .addCase(getSiteTourPicturePoolAction.pending, (state) => {
        state.siteTourPicturesLoading = true;
        state.siteTourPicturesError = null;
      })
      .addCase(getSiteTourPicturePoolAction.fulfilled, (state, action) => {
        state.siteTourPicturesLoading = false;
        state.siteTourPictures = action.payload;
        state.siteTourPicturesError = null;
      })
      .addCase(getSiteTourPicturePoolAction.rejected, (state, action) => {
        state.siteTourPicturesLoading = false;
        state.siteTourPicturesError = action.payload;
        state.siteTourPictures = null;
      })

      // Delete Site Tour Picture
      .addCase(deleteSiteTourPictureAction.pending, (state) => {
        state.deleteSiteTourPictureLoading = true;
        state.deleteSiteTourPictureError = null;
      })
      .addCase(deleteSiteTourPictureAction.fulfilled, (state, action) => {
        state.deleteSiteTourPictureLoading = false;
        state.deleteSiteTourPictureData = action.payload;
        state.deleteSiteTourPictureError = null;
      })
      .addCase(deleteSiteTourPictureAction.rejected, (state, action) => {
        state.deleteSiteTourPictureLoading = false;
        state.deleteSiteTourPictureError = action.payload;
        state.deleteSiteTourPictureData = null;
      });
  }
});

export const {
  resetSitePictureState,
  resetAddSitePictureState,
  resetMySitePicturesState,
  resetDeleteSitePictureState,
  resetSiteTourPicturesState,
  resetAddSiteTourPictureState,
  resetDeleteSiteTourPictureState,
  resetSiteSliceState
} = siteSlice.actions;

export default siteSlice.reducer;
