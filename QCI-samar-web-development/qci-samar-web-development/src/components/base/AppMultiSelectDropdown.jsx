import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Select from '@mui/material/Select';
import { useTheme } from '@mui/material/styles';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Icons from '../../constants/Icons';
import AppButton from './AppButton';
import AppInput from './textInput/AppInput';

// Show 8 option rows at a time (scroll for the rest), plus room for the sticky
// search header that sits above the list. Each row is pinned to OPTION_ROW_HEIGHT
// so the count is exact regardless of font/theme.
const OPTION_ROW_HEIGHT = 48;
const SEARCH_HEADER_HEIGHT = 76;
const MENU_MAX_HEIGHT = OPTION_ROW_HEIGHT * 8 + SEARCH_HEADER_HEIGHT;

// Hysteresis (px) so the menu doesn't flip-flop between above/below right at the boundary.
const FLIP_HYSTERESIS = 24;

// Hoisted constants so the chip/option subtrees don't allocate fresh styles/handlers/icons
// on every render — keeps scroll-driven re-renders cheap (the cause of the stutter).
const CHIP_WRAP_SX = { display: 'flex', flexWrap: 'wrap', gap: 0.5 };
const CHIP_SPAN_STYLE = { display: 'flex', alignItems: 'center' };
// align-items flex-start + gap so the trailing check icon sits beside multi-line labels
// without overlapping, and the label is free to wrap onto multiple lines.
const ITEM_ROW_SX = { display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%', justifyContent: 'space-between' };
const ITEM_LABEL_SX = { whiteSpace: 'normal', wordBreak: 'break-word', flex: 1, fontWeight: 500, fontSize: '14px' };
const _ITEM_CHECK_SX = { flexShrink: 0, marginTop: '2px' };
// Optional rich-option layout: name • phone on the first line, then a muted
// description paragraph. Only rendered when the option supplies phone/description.
const ITEM_TEXT_WRAP_SX = { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 };
const ITEM_META_SX = { color: 'var(--text-3)', fontWeight: 500, fontSize: '12px' };
const ITEM_DESC_SX = { color: 'var(--text-2)', fontSize: '12px', whiteSpace: 'normal', wordBreak: 'break-word', fontWeight: 400, paddingTop: '2px' };
const CHIP_DELETE_ICON = <img src={Icons.cross} alt="cross" className="icon-12" style={{ zIndex: 9 }} />;
const stopMouseDown = e => e.stopPropagation();

const AppMultiSelectDropdown = ({
  label = 'Select',
  subLabel,
  isRequired,
  options = [],
  value = [],
  error,
  selectAllOption = false,
  onChange = () => undefined,
  _placeholder = '',
  name = '',
  customDropdownClass = '',
  bgColor,
  chipMode = false,
  // When true, option rows render the rich layout (name • phone, then a muted
  // description paragraph). Otherwise each row is a plain label.
  richOptions = false,
  ...props
}) => {
  const theme = useTheme();

  const [search, setSearch] = useState('');
  // Decide whether the menu opens downward ('bottom') or upward ('top')
  // based on available space, so it never overlaps the input.
  const [menuPlacement, setMenuPlacement] = useState('bottom');
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorElRef = useRef(null);
  // Popover action handle so we can imperatively reposition the menu on scroll.
  const menuActionRef = useRef(null);
  // Mirror of menuPlacement readable synchronously inside scroll handlers.
  const menuPlacementRef = useRef('bottom');
  // The in-menu search box. We focus it on open so keystrokes go to the search
  // instead of MUI Select's built-in type-ahead (which otherwise focuses the
  // previously-selected option and swallows typing after the first selection).
  const searchInputRef = useRef(null);

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
    // Apply hysteresis so it doesn't rapidly flip-flop while scrolling near the boundary.
    const threshold = Math.min(MENU_MAX_HEIGHT, spaceAbove);
    let next;
    if (menuPlacementRef.current === 'top') {
      next = spaceBelow > threshold + FLIP_HYSTERESIS ? 'bottom' : 'top';
    } else {
      next = spaceBelow < threshold ? 'top' : 'bottom';
    }
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
    let rafId = null;
    const handler = () => {
      // Coalesce multiple scroll events into a single update per animation frame so we
      // don't do redundant measure/flip/reposition work (MUI's Popover also repositions
      // on window scroll, so without throttling we'd thrash layout every event).
      if (rafId !== null) {
        return;
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        // Re-evaluate above/below as the input moves (flushing synchronously so the
        // flip applies immediately), then reposition so the menu stays glued to the input.
        computePlacement(true);
        if (menuActionRef.current) {
          menuActionRef.current.updatePosition();
        }
      });
    };
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
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

  // Move focus into the search box once the menu has mounted, so typing filters
  // the list instead of triggering MUI's type-ahead on the selected option.
  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const timeoutId = setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => clearTimeout(timeoutId);
  }, [menuOpen]);

  // Defensive: always use arrays for value and options and memoize expensive ops
  const safeValue = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const safeOptions = useMemo(() => (Array.isArray(options) ? options : []), [options]);
  const filteredOptions = useMemo(() => safeOptions.filter(option => (option && option.label ? option.label.toLowerCase().includes(search.toLowerCase()) : false)), [safeOptions, search]);
  // O(1) value -> label lookup so each chip doesn't do an O(M) find on every render.
  const optionLabelMap = useMemo(() => {
    const map = new Map();
    safeOptions.forEach(opt => map.set(String(opt.value), opt.label));
    return map;
  }, [safeOptions]);
  const handleChange = event => {
    const {
      target: { value: newValue },
    } = event;
    // newValue will be an array for multiple Select
    onChange(Array.isArray(newValue) ? newValue : []);
    setSearch('');
  };

  // Build the selected chips once per value/options change. Because MUI's SelectInput
  // calls renderValue() on EVERY render (including scroll-driven flip re-renders), we
  // return this memoized element so the chip subtree keeps a stable reference and React
  // skips rebuilding it during scroll — this is the main stutter fix.
  const renderedChips = useMemo(() => {
    if (!chipMode) {
      return null;
    }
    return (
      <Box sx={CHIP_WRAP_SX}>
        {safeValue.map(val => (
          <span key={val} style={CHIP_SPAN_STYLE} onMouseDown={stopMouseDown}>
            <Chip
              className="multiSelected"
              label={optionLabelMap.get(String(val)) ?? val}
              onDelete={() => onChange(safeValue.filter(item => item !== val).map(String))}
              deleteIcon={CHIP_DELETE_ICON}
            />
          </span>
        ))}
      </Box>
    );
  }, [chipMode, safeValue, optionLabelMap, onChange]);

  const renderValue = useCallback(
    selected => {
      if (props.renderValue) {
        return props.renderValue(selected);
      }
      if (chipMode) {
        return renderedChips;
      }
      const count = Array.isArray(selected) ? selected.length : 0;
      return `${count} selected`;
    },
    [props.renderValue, chipMode, renderedChips],
  );

  // O(1) selected-value membership so building the menu items is O(M), not O(N*M).
  const selectedValueSet = useMemo(() => new Set(safeValue.map(String)), [safeValue]);

  // Build the menu option items once per options/value change so scroll-driven
  // re-renders don't re-run membership checks/sx/img for every option each frame.
  const menuItems = useMemo(() => {
    if (filteredOptions.length === 0) {
      return (
        <MenuItem disabled className="fs-14 fw-500 heading-color justify-content-center">
          No option found
        </MenuItem>
      );
    }
    return filteredOptions.map(option => {
      const isSelected = selectedValueSet.has(String(option.value));
      return (
        <MenuItem
          key={option.value}
          value={option.value}
          disabled={!!option.disabled}
          style={{ fontWeight: isSelected ? theme.typography.fontWeightMedium : theme.typography.fontWeightRegular, minHeight: OPTION_ROW_HEIGHT, paddingTop: 8, paddingBottom: 8 }}>
          <Box sx={ITEM_ROW_SX}>
            {richOptions && (option.phone || option.description || option.unavailableReason) ? (
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
                {option.unavailableReason ? <span className="option-unavailable-reason">Unavailable · {option.unavailableReason}</span> : null}
              </span>
            ) : (
              <span style={ITEM_LABEL_SX}>{option.label}</span>
            )}
          </Box>
        </MenuItem>
      );
    });
  }, [filteredOptions, selectedValueSet, theme, richOptions]);

  return (
    <div>
      <FormControl sx={{ m: 1 }} className="w-100">
        <InputLabel
          id={`${name}-multiple-chip-label`}
          sx={{
            top: '-5px',
            fontFamily: 'Inter-medium',
            color: 'var(--text-3)',
            fontSize: '14px',
            '&.MuiInputLabel-shrink': {
              top: '0',
              fontSize: '16px',
              color: 'var(--text-1)!important',
            },
          }}>
          {label}
          {isRequired && <span className="asterics">*</span>}
        </InputLabel>

        <Select
          sx={{
            minHeight: '45px',
            backgroundColor: bgColor || '#FCFCFC',
            '& .MuiSelect-select': {
              minHeight: '45px',
              display: 'flex',
              alignItems: 'center',
              padding: '10px 14px',
              boxSizing: 'border-box',
            },
            '& .MuiInputLabel-root': {
              top: '-5px',
              fontSize: '14px',
              color: error ? 'var(--danger-primary) !important' : 'var(--text-3)',
            },
            '& .MuiInputLabel-shrink': {
              top: '0',
              fontSize: '15px !important',
              color: error ? 'var(--danger-primary) !important' : 'var(--heading)!important',
            },
            '& .MuiOutlinedInput-notchedOutline': {
              border: error ? '1px solid var(--danger-primary)' : '1px solid var(--outline)',
              borderRadius: 'var(--radius-8)',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: error ? 'var(--danger-primary)' : 'var(--outline)',
            },
            '&.Mui-focused': {
              backgroundColor: '#ffffff',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: error ? 'var(--danger-primary)' : 'var(--primary)',
              },
            },
          }}
          labelId={`${name}-multiple-chip-label`}
          id={`${name}-multiple-chip`}
          multiple
          value={safeValue}
          onChange={handleChange}
          input={<OutlinedInput id={`select-multiple-chip-${name}`} label={label} />}
          // show number of selected items when closed; allow parent to override via `renderValue` prop
          renderValue={renderValue}
          className={customDropdownClass}
          {...props}
          onOpen={handleMenuOpen}
          onClose={handleMenuClose}
          MenuProps={{
            // Don't lock body scroll while the menu is open.
            disableScrollLock: true,
            // Don't auto-focus the (previously) selected option on open — that's what
            // steals keystrokes into MUI's type-ahead. We focus the search box instead.
            autoFocus: false,
            // Reposition the menu as the page scrolls so it follows the input.
            action: menuActionRef,
            // Don't clamp the menu inside the viewport — let it stay glued to the
            // input and scroll off-screen with it instead of sticking to top/bottom.
            marginThreshold: null,
            // Open below the input by default, or above it when there's no room
            // below — so the menu never overlaps the input.
            anchorOrigin: menuPlacement === 'top' ? { vertical: 'top', horizontal: 'left' } : { vertical: 'bottom', horizontal: 'left' },
            transformOrigin: menuPlacement === 'top' ? { vertical: 'bottom', horizontal: 'left' } : { vertical: 'top', horizontal: 'left' },
            ...(props.MenuProps || {}),
            slotProps: {
              ...(props.MenuProps?.slotProps || {}),
              list: { autoFocusItem: false, ...(props.MenuProps?.slotProps?.list || {}) },
              paper: {
                ...(props.MenuProps?.slotProps?.paper || {}),
                style: { maxHeight: MENU_MAX_HEIGHT, width: 250, ...(props.MenuProps?.slotProps?.paper?.style || {}) },
              },
            },
          }}>
          {/* Search input fixed at the top of dropdown, not inside scrollable list */}
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
                inputRef={searchInputRef}
                onChange={e => setSearch(e.target.value)}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
                style={{ width: '100%', margin: 0 }}
                autoComplete="off"
              />
            </div>
          </MenuItem>
          {menuItems}
        </Select>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
          {selectAllOption && safeValue.length < safeOptions.length && (
            <AppButton type="button" variant="link" size="small" onClick={() => onChange(safeOptions.map(opt => opt.value))} title={'Select All'} customClass={'h-36'} />
          )}
          {safeValue.length > 0 && <AppButton type="button" variant="danger-link" size="small" onClick={() => onChange([])} title={'Remove All'} />}
        </Box>

        {error && <span className="error-text margin-top-4">{error}</span>}

        {subLabel ? <p className="fs-12 fw-italic-400 mb-0 margin-top-4 text-3-color">{subLabel}</p> : null}
      </FormControl>
    </div>
  );
};

export default AppMultiSelectDropdown;
