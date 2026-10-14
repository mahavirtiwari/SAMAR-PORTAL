// Keyboard + touch support for non-button elements that act as controls.
// Spread onto a div/span/etc. in place of `onClick`: adds role, focusability and Enter/Space activation.
// A falsy handler yields no props, so `onActivate(cond ? fn : undefined)` stays inert.
// Keys are only handled when the element itself has focus, so a nested control's Enter/Space
// does not also trigger its clickable ancestor.
const activationProps = role => handler => {
  if (!handler) {
    return {};
  }
  return {
    role,
    tabIndex: 0,
    onClick: handler,
    onKeyDown: e => {
      if (e.target !== e.currentTarget) {
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler(e);
      }
    },
  };
};

export const onActivate = activationProps('button');

// Same as onActivate, for elements that navigate to another route.
export const onActivateLink = activationProps('link');
