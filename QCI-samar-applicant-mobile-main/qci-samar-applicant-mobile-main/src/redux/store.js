import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { injectStore } from '../services/api/clients/userClient';
import { resetStore } from './action/resetStore';
import AccountSlice from './slices/accountSlice';
import ApplicationSlice from './slices/applicationSlice';
import SiteSlice from './slices/siteSlice';

const appReducer = combineReducers({
  account: AccountSlice,
  application: ApplicationSlice,
  site: SiteSlice,
});

const rootReducer = (state, action) =>
  appReducer(action.type === resetStore.type ? undefined : state, action);

const store = configureStore({
  reducer: rootReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

// Give userClient access to the store so its interceptors can dispatch
// refreshToken / logout without creating an import cycle through the slice.
injectStore(store);

export default store;
