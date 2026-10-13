import { createAction } from '@reduxjs/toolkit';

// Dispatched on logout after the local data wipe. The root reducer in store.js
// listens for this and rebuilds every slice from its initial state, so no slice
// retains the previous user's data. Kept dependency-free (only RTK) so store.js
// can import it without pulling in the thunk -> Api -> userClient -> store cycle.
export const resetStore = createAction('app/resetStore');
