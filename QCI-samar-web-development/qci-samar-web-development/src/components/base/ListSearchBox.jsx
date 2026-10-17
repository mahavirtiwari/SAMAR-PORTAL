import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import Icons from '../../constants/Icons';
import AppInput from './textInput/AppInput';

/**
 * The search box in a list page header. Keeps what is typed locally and calls
 * `onSearch` once typing pauses (300 ms), so the list is not re-fetched on every
 * keystroke. `value` is the search currently applied to the list.
 */
const ListSearchBox = ({ value = '', onSearch, placeholder = 'Search', name = 'search' }) => {
  const [text, setText] = useState(value);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  // Follow outside resets (e.g. a "Reset filters" button).
  useEffect(() => setText(value), [value]);

  useEffect(() => {
    const next = text.trim();
    if (next === (value || '').trim()) {
      return undefined;
    }
    const id = setTimeout(() => onSearchRef.current(next), 300);
    return () => clearTimeout(id);
  }, [text, value]);

  return (
    <AppInput
      label="Search"
      inputType="search"
      name={name}
      customInputClass="search-input"
      value={text}
      onChange={e => setText(e.target.value)}
      placeholder={placeholder}
      customWidth="100%"
      leftIcon={Icons.search}
      marginLeft="6px"
      // Keep the "Search" label raised so the hint (e.g. "Search assessor domains")
      // is visible before the box is clicked.
      slotProps={{ inputLabel: { shrink: true } }}
    />
  );
};

ListSearchBox.propTypes = {
  value: PropTypes.string,
  onSearch: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  name: PropTypes.string,
};

export default ListSearchBox;
