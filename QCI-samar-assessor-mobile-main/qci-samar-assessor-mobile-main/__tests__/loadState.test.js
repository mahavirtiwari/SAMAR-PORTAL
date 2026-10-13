import { shouldShowApplicationLoader } from '../src/utils/loadState';

describe('shouldShowApplicationLoader', () => {
  it('hides the app loader while the initial screen loader is active', () => {
    expect(shouldShowApplicationLoader({ showInitialLoader: true, isBusy: true })).toBe(false);
  });

  it('shows the app loader when a save or refresh action is busy after initial load', () => {
    expect(shouldShowApplicationLoader({ showInitialLoader: false, isBusy: true })).toBe(true);
  });

  it('keeps the app loader hidden when nothing is busy', () => {
    expect(shouldShowApplicationLoader({ showInitialLoader: false, isBusy: false })).toBe(false);
  });
});
