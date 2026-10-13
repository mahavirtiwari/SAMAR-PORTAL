// True while a fetch has been dispatched but hasn't settled yet — either it's
// loading, OR it hasn't started (no data and no error). Screens gate their
// empty/detail view on this so the first frame shows a loader instead of
// flashing an empty state before the on-mount fetch flips the loading flag.
export const isInitialLoad = (loading, data, error) => loading || (!data && !error);

// Whether the full-screen ApplicationLoader should be up. The two loaders are
// deliberately exclusive: while a screen is doing its FIRST fetch it shows its
// own inline ScreenLoader, and stacking the full-screen overlay on top of that
// makes the screen flash white before its skeleton appears. Once the initial
// load is done, a later save or refresh has no inline loader of its own, so the
// overlay is what tells the user something is happening.
export const shouldShowApplicationLoader = ({ showInitialLoader, isBusy }) =>
  !showInitialLoader && !!isBusy;
