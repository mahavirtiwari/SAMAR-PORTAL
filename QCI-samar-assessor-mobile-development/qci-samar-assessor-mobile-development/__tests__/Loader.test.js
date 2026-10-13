import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import Loader from '../src/components/shared/Loader';

// The overlay is held by named owners. It stays up while any owner holds it,
// re-acquiring by the same owner is a no-op, and reset() is the escape hatch
// for an owner that was torn down without releasing.
describe('Loader', () => {
  const mount = async () => {
    let renderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<Loader />);
    });
    return renderer;
  };

  const act = (fn) => ReactTestRenderer.act(async () => fn());

  it('renders nothing until an owner takes it', async () => {
    const renderer = await mount();
    expect(renderer.toJSON()).toBeNull();
  });

  it('keeps the overlay visible until every owner has finished', async () => {
    const renderer = await mount();
    const instance = renderer.getInstance();

    await act(() => {
      instance.show('login');
      instance.show('sync');
    });
    expect(renderer.toJSON()).not.toBeNull();

    // The bug this replaced: the first owner to finish hid the overlay while
    // the second was still working.
    await act(() => instance.hide('login'));
    expect(renderer.toJSON()).not.toBeNull();

    await act(() => instance.hide('sync'));
    expect(renderer.toJSON()).toBeNull();
  });

  it('does not double-count an owner that acquires repeatedly', async () => {
    const renderer = await mount();
    const instance = renderer.getInstance();

    // Callers are level-triggered, so the same owner calls show() on every
    // dependency change without a matching hide. One release must still free it,
    // or the overlay would be stranded over a working app.
    await act(() => {
      instance.show('siteTour');
      instance.show('siteTour');
      instance.show('siteTour');
    });
    await act(() => instance.hide('siteTour'));

    expect(renderer.toJSON()).toBeNull();
  });

  it('ignores a release from an owner that never held it', async () => {
    const renderer = await mount();
    const instance = renderer.getInstance();

    await act(() => instance.show('openingMeeting'));
    await act(() => instance.hide('somethingElse'));

    expect(renderer.toJSON()).not.toBeNull();
  });

  it('reset clears every owner', async () => {
    const renderer = await mount();
    const instance = renderer.getInstance();

    await act(() => {
      instance.show('a');
      instance.show('b');
    });
    await act(() => instance.reset());

    expect(renderer.toJSON()).toBeNull();
  });
});
