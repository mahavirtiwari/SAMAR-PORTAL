import { Box, InputAdornment, MenuItem, Select, TextField, Typography } from '@mui/material';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const MENU_MAX_HEIGHT = 320;

const AppInputWithDropdown = ({
  label = '',
  subLabel = '',
  isRequired = true,
  name = '',
  placeholder = '',
  value = '',
  onChange = () => undefined,
  onBlur = () => undefined,
  unit = '',
  onUnitChange = () => undefined,
  unitOptions = [],
  error = '',
  disableDropdown = false,
  bgColor,
  numericFormat = false,
  maxValue = null,
  maxDigits = 12,
}) => {
  // Decide whether the unit menu opens downward ('bottom') or upward ('top')
  // based on available space, so it never overlaps the input.
  const [menuPlacement, setMenuPlacement] = useState('bottom');
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorElRef = useRef(null);
  // Popover action handle so we can imperatively reposition the menu on scroll.
  const menuActionRef = useRef(null);
  // Mirror of menuPlacement readable synchronously inside scroll handlers.
  const menuPlacementRef = useRef('bottom');

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
  };

  const handleMenuClose = () => {
    setMenuOpen(false);
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

  const handleChange = e => {
    let inputValue = e.target.value;

    if (numericFormat) {
      // Allow only numbers and one decimal point
      inputValue = inputValue.replace(/[^\d.]/g, '');

      // Remove multiple decimal points
      const parts = inputValue.split('.');
      if (parts.length > 2) {
        inputValue = parts[0] + '.' + parts.slice(1).join('');
      }

      // Validate format: max digits before decimal (configurable), max 2 after
      const [integerPart, decimalPart] = inputValue.split('.');
      if (integerPart && integerPart.length > maxDigits) {
        inputValue = integerPart.slice(0, maxDigits) + (decimalPart ? '.' + decimalPart : '');
      }
      if (decimalPart && decimalPart.length > 2) {
        inputValue = integerPart + '.' + decimalPart.slice(0, 2);
      }

      // Validate maxValue if provided
      if (maxValue !== null && inputValue) {
        const numericValue = parseFloat(inputValue);
        if (!isNaN(numericValue) && numericValue > maxValue) {
          // Prevent the value from being set if it exceeds maxValue
          return;
        }
      }

      e.target.value = inputValue;
    }

    onChange(e);
  };
  return (
    <div className="cus-input-with-dd">
      <Box sx={{ width: '100%' }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder={placeholder || 'Enter Capacity'}
          name={name}
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          error={!!error}
          helperText={error}
          label={
            <span className="input-label" style={{ top: '-5px', fontSize: '14px' }}>
              {label}
              <span className="asterics">{isRequired ? '*' : null}</span>
            </span>
          }
          sx={{
            '& .MuiOutlinedInput-root': {
              height: '45px',
              borderRadius: '8px',
              '& input': {
                padding: '10px 14px',
                boxSizing: 'border-box',
                backgroundColor: bgColor || '#FCFCFC',
              },
              '&.Mui-focused input': {
                backgroundColor: '#ffffff',
              },
              '& fieldset': {
                borderColor: 'var(--outline, #D1D5DB)',
              },
              '&:hover fieldset': {
                borderColor: '#000',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#000',
                borderWidth: '1px',
              },
            },
            '& .MuiInputLabel-root': {
              top: '-5px',
              fontSize: '14px',
              color: 'var(--text-3) !important',
            },
            '& .MuiInputLabel-shrink': {
              top: '0',
              fontSize: '16px',
              color: 'var(--text-1)!important',
            },
          }}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end" sx={{ marginRight: '-14px', zIndex: 9 }}>
                  {disableDropdown ? (
                    <Box
                      className="static-unit-text-bx"
                      sx={{
                        height: '45px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 90,
                        px: '12px',
                        background: 'transparent',
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        '& .static-unit-text': {
                          width: '100%',
                          boxSizing: 'border-box',
                        },
                        pointerEvents: 'none',
                      }}>
                      <Typography variant="none" className="static-unit-text">
                        {unit || '-'}
                      </Typography>
                    </Box>
                  ) : (
                    <Select
                      value={unit}
                      onChange={onUnitChange}
                      onOpen={handleMenuOpen}
                      onClose={handleMenuClose}
                      variant="outlined"
                      displayEmpty
                      sx={{
                        height: '45px',
                        background: 'transparent',
                        boxShadow: 'none',
                        '.MuiOutlinedInput-notchedOutline': {
                          borderTopLeftRadius: 0,
                          borderBottomLeftRadius: 0,
                        },
                        '& .MuiSelect-select': {
                          padding: '10px 14px',
                          fontSize: 'var(--fs-xs)',
                          fontFamily: 'Inter-Medium',
                          color: 'var(--text-3)',
                          backgroundColor: 'var(--background)',
                        },
                        minWidth: 90,
                      }}
                      inputProps={{
                        'aria-label': 'Unit',
                        name: name ? `${name}-unit` : 'unit',
                      }}
                      MenuProps={{
                        // Don't lock body scroll while the menu is open.
                        disableScrollLock: true,
                        // Reposition the menu as the page scrolls so it follows the input.
                        action: menuActionRef,
                        // Don't clamp the menu inside the viewport — let it stay glued to the
                        // input and scroll off-screen with it instead of sticking to top/bottom.
                        marginThreshold: null,
                        // Open below the input by default, or above it when there's no room
                        // below — so the menu never overlaps the input.
                        anchorOrigin: menuPlacement === 'top' ? { vertical: 'top', horizontal: 'left' } : { vertical: 'bottom', horizontal: 'left' },
                        transformOrigin: menuPlacement === 'top' ? { vertical: 'bottom', horizontal: 'left' } : { vertical: 'top', horizontal: 'left' },
                        slotProps: {
                          paper: {
                            sx: {
                              zIndex: 2000,
                              maxHeight: MENU_MAX_HEIGHT,
                            },
                          },
                        },
                      }}>
                      {unitOptions.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                </InputAdornment>
              ),
            },

            inputLabel: {
              classes: { shrink: 'input-label-shrink' },
            },
          }}
        />
        {subLabel && (
          <Typography variant="none" className="fs-12 fw-italic-400 text-3-color">
            {subLabel}
          </Typography>
        )}
      </Box>
    </div>
  );
};

export default AppInputWithDropdown;
