import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import AppButton from './AppButton';
import AppInput from './textInput/AppInput';

// Optional rich-option layout: name • phone on the first line, then a muted
// description paragraph. Only rendered when the option supplies phone/description.
const ITEM_TEXT_WRAP_SX = { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 };
const ITEM_LABEL_SX = { whiteSpace: 'normal', wordBreak: 'break-word', flex: 1, fontWeight: 500, fontSize: '14px' };
const ITEM_META_SX = { color: 'var(--text-3)', fontWeight: 500, fontSize: '12px' };
const ITEM_DESC_SX = { color: 'var(--text-2)', fontSize: '12px', whiteSpace: 'normal', wordBreak: 'break-word', fontWeight: 400, paddingTop: '6px' };

const AppDropdown = ({
  label = '',
  value = '',
  selected,
  onChange = () => undefined,
  onBlur,
  options = [],
  error = '',
  name = '',
  isRequired = false,
  bgColor,
  _color,
  customDropdownClass = '',
  buttonTitle,
  subLabel,
  onClick = () => undefined,
  searchable = true,
  resetKey,
  // When true, option rows render the rich layout (name • phone, then a muted
  // description paragraph). Otherwise each row is a plain label.
  richOptions = false,
  ...props
}) => {
  const [search, setSearch] = useState('');
  // Show 8 option rows at a time (scroll for the rest). Each option row is pinned
  // to OPTION_ROW_HEIGHT so the count is exact regardless of font/theme, plus room
  // for the sticky search header when the dropdown is searchable.
  const OPTION_ROW_HEIGHT = 48;
  const SEARCH_HEADER_HEIGHT = 76;
  const MENU_MAX_HEIGHT = 8 * OPTION_ROW_HEIGHT + (searchable ? SEARCH_HEADER_HEIGHT : 0);
  // Decide whether the menu opens downward ('bottom') or upward ('top')
  // based on available space, so it never overlaps the input.
  const [menuPlacement, setMenuPlacement] = useState('bottom');
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorElRef = useRef(null);
  // Popover action handle so we can imperatively reposition the menu on scroll.
  const menuActionRef = useRef(null);
  // Mirror of menuPlacement readable synchronously inside scroll handlers.
  const menuPlacementRef = useRef('bottom');

  useEffect(() => {
    setSearch('');
  }, [resetKey]);

  // Measure available space and update placement. When `sync` is true the state
  // update is flushed synchronously so the new origins are applied before we call
  // updatePosition() — this removes the brief lag where the menu stays in the old
  // position for ~10-15px of scroll before flipping.
  const computePlacement = (sync = false) => {
    const anchor = anchorElRef.current;
    if (!anchor || typeof anchor.getBoundingClientRect !== 'function') {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // Open upward only when there isn't enough room below AND there's more room above.
    const next = spaceBelow < Math.min(MENU_MAX_HEIGHT, spaceAbove) ? 'top' : 'bottom';
    if (next === menuPlacementRef.current) {
      return;
    }
    menuPlacementRef.current = next;
    if (sync) {
      flushSync(() => setMenuPlacement(next));
    } else {
      setMenuPlacement(next);
    }
  };

  const handleMenuOpen = e => {
    anchorElRef.current = e?.currentTarget || null;
    setMenuOpen(true);
    computePlacement();
    if (typeof props.onOpen === 'function') {
      props.onOpen(e);
    }
  };

  const handleMenuClose = (e, reason) => {
    setMenuOpen(false);
    setSearch('');
    if (typeof props.onClose === 'function') {
      props.onClose(e, reason);
    }
  };

  // While the menu is open, re-evaluate placement (and reposition the Popover)
  // as the user scrolls/resizes, so it flips above the input instead of overlapping it.
  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const handler = () => {
      // Re-evaluate above/below as the input moves (flushing synchronously so the
      // flip applies immediately), then reposition so the menu stays glued to the input.
      computePlacement(true);
      if (menuActionRef.current) {
        menuActionRef.current.updatePosition();
      }
    };
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [menuOpen]);

  // After a placement flip re-renders with new origins, reposition before the
  // browser paints (useLayoutEffect) so the menu never flashes over the input.
  useLayoutEffect(() => {
    if (menuOpen && menuActionRef.current) {
      menuActionRef.current.updatePosition();
    }
  }, [menuPlacement]);

  // Support both value/selected and onChange/onSelect props
  const currentValue = selected !== undefined ? selected : value;
  const handleChange = onChange;

  // Filter options based on search (defensive: ensure options is an array)
  const safeOptions = Array.isArray(options) ? options : [];
  const filteredOptions = searchable ? safeOptions.filter(option => (option && option.label ? option.label.toLowerCase().includes(search.toLowerCase()) : false)) : safeOptions;

  // For rich options the menu row shows name/phone/description, but the collapsed
  // input must show only the selected name (otherwise the long description spills
  // out of the box). renderValue maps the selected value back to its label.
  const renderSelectedValue = richOptions
    ? val => {
        const match = safeOptions.find(option => option && String(option.value) === String(val));
        return match ? match.label : '';
      }
    : undefined;
  return (
    <Box sx={{ minWidth: 120 }} className="singleDropdown">
      <FormControl fullWidth error={!!error} variant="outlined">
        <InputLabel
          id={`${name}-select-label`}
          sx={{
            top: '-5px',
            fontSize: '14px',
            fontFamily: 'Inter-medium',
            backgroundColor: bgColor || 'inherit',
            color: 'var(--text-3)!important',
            padding: '0 4px',
            '&.MuiInputLabel-shrink': {
              top: '0',
              fontSize: '16px !important',
              color: 'var(--heading)!important',
            },
            '& .MuiInputLabel-root': { fontSize: '14px !important', fontFamily: 'Inter-medium', color: 'var(--text-3)!important' },
            '& .MuiInputLabel-shrink': { fontSize: '16px !important', color: 'var(--heading)!important' },
          }}>
          {label}
          {isRequired && <span className="asterics">*</span>}
        </InputLabel>
        <Select
          labelId={`${name}-select-label`}
          id={`${name}-select`}
          value={currentValue}
          {...(renderSelectedValue ? { renderValue: renderSelectedValue } : {})}
          label={label}
          onChange={handleChange}
          onBlur={onBlur}
          name={name}
          className={`input-style${customDropdownClass ? ' ' + customDropdownClass : ''}`}
          variant="outlined"
          sx={{
            height: '45px',
            backgroundColor: bgColor || 'inherit',
            transition: 'background-color 180ms ease, box-shadow 200ms ease, border-color 200ms ease',
            // color: color || 'inherit',
            borderRadius: 'var(--radius-8)',
            '& .MuiOutlinedInput-notchedOutline': {
              border: '1px solid var(--outline)',
              borderRadius: 'var(--radius-8)',
            },
            '&.Mui-focused': {
              backgroundColor: '#ffffff',
              '& .MuiOutlinedInput-notchedOutline': {
                border: '1px solid var(--outline)',
              },
            },
            '& .MuiSelect-select': {
              padding: '10px 14px',
              boxSizing: 'border-box',
              // display: 'flex',
              alignItems: 'center',
              height: '45px',
            },
            '& input': {
              padding: '10px 14px',
              boxSizing: 'border-box',
              fontSize: '14px !important',
              fontFamily: 'Inter-medium',
              color: 'var(--text-3)!important',
            },
          }}
          {...props}
          onOpen={handleMenuOpen}
          onClose={handleMenuClose}
          MenuProps={{
            // Keep focus on the sticky search field while typing. Without these, MUI's
            // menu re-focuses an option row after each keystroke, so the search box
            // loses focus and only the first character registers.
            autoFocus: false,
            disableAutoFocusItem: true,
            // Don't lock body scroll while the menu is open.
            disableScrollLock: true,
            // Reposition the menu as the page scrolls so it follows the input.
            action: menuActionRef,
            // Don't clamp the menu inside the viewport — let it stay glued to the
            // input and scroll off-screen with it instead of sticking to top/bottom.
            marginThreshold: null,
            // Open below the input by default, or above it when there's no room
            // below — so the menu never overlaps the input (like AppSuggestionInput).
            anchorOrigin: menuPlacement === 'top' ? { vertical: 'top', horizontal: 'left' } : { vertical: 'bottom', horizontal: 'left' },
            transformOrigin: menuPlacement === 'top' ? { vertical: 'bottom', horizontal: 'left' } : { vertical: 'top', horizontal: 'left' },
            ...(props.MenuProps || {}),
            slotProps: {
              ...(props.MenuProps?.slotProps || {}),
              paper: {
                ...(props.MenuProps?.slotProps?.paper || {}),
                // Explicit width so long rich-option descriptions wrap at the input
                // width instead of stretching the menu to the viewport. MUI keeps the
                // anchor's width as the min, so the menu still matches the input.
                style: { maxHeight: MENU_MAX_HEIGHT, width: 250, ...(props.MenuProps?.slotProps?.paper?.style || {}) },
              },
            },
          }}>
          {searchable && (
            <MenuItem style={{ cursor: 'default', background: '#fff', position: 'sticky', top: 0, zIndex: 2, padding: 0 }} disableRipple disableTouchRipple>
              <div
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
                onFocus={e => e.stopPropagation()}
                className="padding-right-15 padding-left-15 padding-top-15 padding-bottom-15"
                style={{ width: '100%' }}>
                <AppInput
                  label="Search..."
                  value={search}
                  inputType="search"
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  style={{ width: '100%', margin: 0 }}
                  autoComplete="off"
                  rightIconOnClick={() => setSearch('')} // Clear search on icon click
                />
              </div>
            </MenuItem>
          )}
          {filteredOptions.length > 0 ? (
            filteredOptions.map(option => (
              <MenuItem key={option.value} value={option.value} sx={{ minHeight: OPTION_ROW_HEIGHT, paddingTop: 1, paddingBottom: 1, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.4 }}>
                {richOptions && (option.phone || option.description) ? (
                  <span style={ITEM_TEXT_WRAP_SX}>
                    <span style={ITEM_LABEL_SX}>
                      {option.label}
                      {option.phone ? (
                        <span className="rich-option-phone" style={ITEM_META_SX}>
                          {option.phone}
                        </span>
                      ) : null}
                    </span>
                    {option.description ? <span style={ITEM_DESC_SX}>{option.description}</span> : null}
                  </span>
                ) : (
                  option.label
                )}
              </MenuItem>
            ))
          ) : (
            <MenuItem disabled className="fs-14 fw-500 heading-color justify-content-center">
              No option found
            </MenuItem>
          )}
          {buttonTitle ? (
            <div className="drodown-footer">
              <AppButton variant="secondary" size="small" title={buttonTitle} onClick={onClick} />
            </div>
          ) : null}
        </Select>
        {subLabel ? <p className="fs-12 fw-italic-400 mb-0 margin-top-4 text-3-color margin-bottom-4">{subLabel}</p> : null}
        {error && <span className="error-text margin-top-4">{error}</span>}
      </FormControl>
    </Box>
  );
};

export default AppDropdown;
