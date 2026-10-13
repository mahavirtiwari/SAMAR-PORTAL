import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { resetStore } from './action/resetStore';
import AccountSlice from './slices/accountSlice';
import AssessmentParameterSlice from './slices/assessmentParameterSlice';
import assessmentResponseSlice from './slices/assessmentResponseSlice';
import AssessmentSlice from './slices/assessmentSlice';
import BasicInformationSlice from './slices/basicInformationSlice';
import MeetingSlice from './slices/meetingSlice';
import siteSlice from './slices/siteSlice';

const appReducer = combineReducers({
  account: AccountSlice,
  assessment: AssessmentSlice,
  basicInformation: BasicInformationSlice,
  meeting: MeetingSlice,
  site: siteSlice,
  assessmentParameter: AssessmentParameterSlice,
  assessmentResponse: assessmentResponseSlice
});

const rootReducer = (state, action) =>
  appReducer(action.type === resetStore.type ? undefined : state, action);

const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    })
});

export default store;
