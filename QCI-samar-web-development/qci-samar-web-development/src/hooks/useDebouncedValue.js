import { useEffect, useState } from 'react';

/**
 * Returns `value` once it has stopped changing for `delay` ms. Search boxes bind
 * the raw value to the input and put the debounced one in their fetch effect, so
 * typing a word sends one request instead of one per keystroke.
 */
const useDebouncedValue = (value, delay = 400) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};

export default useDebouncedValue;
