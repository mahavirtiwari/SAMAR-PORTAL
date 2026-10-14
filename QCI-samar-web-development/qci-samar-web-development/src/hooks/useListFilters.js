import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useDebouncedValue from './useDebouncedValue';

/**
 * List-screen filter and pagination state that survives navigation.
 *
 * List screens used to hold all of this in plain component state, so opening a row and
 * pressing Back destroyed whatever the user had filtered down to and they had to set it
 * all up again. The committed filters and the pagination now live in the URL query
 * string, which means Back restores them, a refresh keeps them, and a filtered list can
 * be copied to someone else as a link.
 *
 * Two filter objects, matching how these screens already work:
 *  - `filters` is the draft bound to the inputs, which changes on every keystroke and is
 *    deliberately NOT persisted.
 *  - `appliedFilters` is what the user committed with Apply, and is what drives fetching.
 *
 * @param {Object} defaultFilters - the empty filter shape, e.g. { name: '', type: '' }
 * @param {Object} [options]
 * @param {number} [options.defaultPageSize=10]
 * @param {number} [options.searchDebounceMs=0] - for screens that write the top search box
 *   straight into `appliedFilters.search` on every keystroke: `appliedQuery` then only picks
 *   up a changed `search` once typing has paused this long. Screens that already debounce
 *   their fetch effect, or their commit of the search box, leave it at 0.
 */
const useListFilters = (defaultFilters, { defaultPageSize = 10, searchDebounceMs = 0 } = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // The default shape is fixed for the life of the screen; keeping it in a ref stops a
  // caller's inline object literal from re-seeding state on every render.
  const defaultsRef = useRef(defaultFilters);
  const defaults = defaultsRef.current;

  // Seed state from the URL exactly once, on mount. After that the state is the source of
  // truth and the effect below mirrors it back; the URL is only re-read on a fresh mount,
  // which is precisely the Back and refresh cases this hook exists to handle.
  const initialState = useRef(null);
  if (initialState.current === null) {
    const applied = {};
    for (const key of Object.keys(defaults)) {
      applied[key] = searchParams.get(key) ?? defaults[key];
    }
    const parsedPage = Number.parseInt(searchParams.get('page'), 10);
    const parsedPageSize = Number.parseInt(searchParams.get('pageSize'), 10);
    initialState.current = {
      applied,
      page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      pageSize: Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : defaultPageSize,
    };
  }

  // The draft starts from whatever was committed, so returning to the screen shows the
  // filter controls already reflecting the list being displayed.
  const [filters, setFilters] = useState(initialState.current.applied);
  const [appliedFilters, setAppliedFilters] = useState(initialState.current.applied);
  const [page, setPage] = useState(initialState.current.page);
  const [pageSize, setPageSize] = useState(initialState.current.pageSize);

  // Mirror the committed state into the URL from a single effect that reads the current
  // state, NOT from each setter. Deriving the whole query from state in one place is what
  // keeps every dimension consistent when several change in the same event: an Apply click
  // sets the filters and resets the page together, and the grid sets page and page size
  // together. A per-setter write instead used stale closure values for the dimensions it
  // did not own, so the second setter clobbered the URL the first had just written and the
  // change was lost from the URL (though not from React state) until the next interaction.
  // Running in an effect also keeps setSearchParams out of the render phase.
  //
  // replace, not push: a history entry per filter change would break the Back button, which
  // is the behaviour this hook exists to repair. setSearchParams is held in a ref so it is
  // not an effect dependency — its identity can change with the location, which would
  // otherwise re-run the effect on its own write.
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;
  useEffect(() => {
    const params = {};
    for (const [key, value] of Object.entries(appliedFilters)) {
      if (value !== '' && value !== null && value !== undefined) {
        params[key] = String(value);
      }
    }
    if (page > 1) {
      params.page = String(page);
    }
    if (pageSize !== defaultPageSize) {
      params.pageSize = String(pageSize);
    }
    setSearchParamsRef.current(params, { replace: true });
  }, [appliedFilters, page, pageSize, defaultPageSize]);

  /** Clear both the draft and the committed filters, and go back to the first page. */
  const resetFilters = useCallback(() => {
    setFilters(defaults);
    setAppliedFilters(defaults);
    setPage(1);
  }, [defaults]);

  // What to send to the API: the committed filters with the empty ones dropped, so a
  // cleared filter is absent from the request rather than sent as an empty string, which
  // some endpoints validate against their allowed-values list and reject.
  //
  // With searchDebounceMs set, the search key is debounced. The object identity only
  // changes when the content does: a keystroke that has not yet passed the debounce keeps
  // the previous object, so fetch effects depending on it do not re-run with identical
  // parameters.
  const debouncedSearch = useDebouncedValue(appliedFilters.search, searchDebounceMs);
  const effectiveSearch = searchDebounceMs > 0 ? debouncedSearch : appliedFilters.search;
  const queryRef = useRef(null);
  const appliedQuery = useMemo(() => {
    const query = {};
    for (const [key, value] of Object.entries(appliedFilters)) {
      const effective = key === 'search' ? effectiveSearch : value;
      if (effective !== '' && effective !== null && effective !== undefined) {
        query[key] = effective;
      }
    }
    const previous = queryRef.current;
    const unchanged = previous && Object.keys(previous).length === Object.keys(query).length && Object.entries(query).every(([key, value]) => previous[key] === value);
    if (!unchanged) {
      queryRef.current = query;
    }
    return queryRef.current;
  }, [appliedFilters, effectiveSearch]);

  return {
    filters,
    setFilters,
    appliedFilters,
    appliedQuery,
    setAppliedFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
    resetFilters,
  };
};

export default useListFilters;
