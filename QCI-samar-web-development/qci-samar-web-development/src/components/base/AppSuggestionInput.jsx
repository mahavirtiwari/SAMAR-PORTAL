// import ClearIcon from '@mui/icons-material/Clear';
import { ClickAwayListener } from '@mui/material';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Grow from '@mui/material/Grow';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import TextField from '@mui/material/TextField';
import PropTypes from 'prop-types';
import { useRef, useState } from 'react';
import Icons from '../../constants/Icons';
import AppButton from './AppButton';
import AppIconButton from './AppIconButton';

/**
 * AppSuggestionInput
 * Material-like input that accepts tags (chips) and shows suggestion dropdown.
 *
 * Props (all optional unless noted):
 * - suggestions: Array<string|{label:string,value:string}> - list of suggestion items to show in dropdown.
 * - value: Array<string> (required) - current selected tags.
 * - onChange: function(newValue: Array<string>) - called when tags change (add/remove).
 * - placeholder: string - placeholder text for the input.
 * - label: string - label shown for the input (MUI TextField label).
 * - maxSuggestions: number - max suggestions to display in dropdown.
 * - disableClearOnSelect: boolean - if true, keep input text after selecting a suggestion (default false).
 * - chipProps: object - props passed to each MUI `Chip` (e.g., color, size).
 * - textFieldProps: object - props passed to the underlying MUI `TextField`.
 * - popperProps: object - props passed to the MUI `Popper` component.
 * - onAdd: function(addedItem) - optional callback fired when an item is added.
 * - onDelete: function(deletedItem) - optional callback fired when a tag is removed.
 *
 * Behavior:
 * - Type then press Enter to add a custom tag (if not empty).
 * - Click a suggestion to add it as a tag.
 * - Chips render for each tag with a close icon to remove.
 *
 * Accessibility & notes:
 * - This component implements a simple suggestion popper. For advanced keyboard
 *   navigation and accessibility consider using MUI `Autocomplete` with `multiple` and
 *   `freeSolo` instead.
 */
const AppSuggestionInput = ({
  suggestions = [],
  value,
  onChange,
  placeholder = 'Type to search...',
  label = '',
  disabled,
  isRequired,
  disableClearOnSelect = false,
  textFieldProps = {},
  inputType,
  popperProps = {},
  showLeftIcon,
  marginLeft,
  _onAdd,
  onDelete,
  onToggleOutsourced,
  outsourcedValues,
  initialTags = [],
  error = '',
  subLabel = '',
  max,
  maxSuggestion,
  Outsourced,
  maxSuggestionLength,
  enableBulkActions = false,
  selectAllLabel = 'Select All',
  removeAllLabel = 'Remove All',
  optionWidth = '50%',
  disableAutoCapitalize = false,
}) => {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  const anchorRef = useRef(null);
  // store anchor element in state so we don't read ref.current during render
  const [anchorEl, setAnchorEl] = useState(null);
  const containerRef = useRef(null);
  const chipsWrapperRef = useRef(null);
  // internal tags state used when `value` prop is not provided (uncontrolled mode)
  const [internalTags, setInternalTags] = useState(initialTags || []);
  // Outsourced status is tracked by tag label, never by index: removing a tag shifts
  // every index after it, which would move the tick onto a different service.
  const [outsourcedStatus, setOutsourcedStatus] = useState({});

  // Derive outsourcedSet from outsourcedValues prop without setState
  const outsourcedSet = outsourcedValues && Array.isArray(outsourcedValues) ? new Set(outsourcedValues.map(String)) : new Set();

  // When the parent owns the outsourced list it is the single source of truth; keeping a
  // local copy alongside it only lets the two drift apart.
  const isOutsourcedControlled = Array.isArray(outsourcedValues) && typeof onToggleOutsourced === 'function';

  // unified tags array: prefer controlled `value`, otherwise use internal state
  const tags = value !== undefined && value !== null ? (Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []) : internalTags;

  const maxTagsAllowed = maxSuggestionLength ?? maxSuggestion;

  // For single-selection mode, reflect the selected tag in the input box
  const isSingleSelection = max === 1 || maxTagsAllowed === 1;
  const selectedValueForInput = isSingleSelection && tags && tags.length > 0 ? (typeof tags[0] === 'string' ? tags[0] : tags[0].label || tags[0].value || '') : '';
  const getItemText = item => (typeof item === 'string' ? item : item?.label || item?.value || '');
  const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];
  const suggestionValues = safeSuggestions.map(getItemText).filter(Boolean);
  const hasSuggestionValues = suggestionValues.length > 0;
  const hasTags = tags.length > 0;
  // In multi-select mode, render selected items as chips inside the input box.
  const hasChips = !isSingleSelection && hasTags;
  const selectedTagValues = new Set(tags.map(getItemText).filter(Boolean));
  const areAllSuggestionsSelected = hasSuggestionValues && suggestionValues.every(suggestion => selectedTagValues.has(suggestion));

  const setTags = nextTags => {
    if (onChange) {
      onChange(nextTags);
    } else {
      setInternalTags(nextTags);
    }
  };

  const getUniqueTags = nextTags => {
    const seen = new Set();
    return nextTags.filter(tag => {
      const normalizedTag = String(getItemText(tag) || tag || '').trim();
      const key = normalizedTag;
      if (!normalizedTag || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  const isTagOutsourced = labelText => (isOutsourcedControlled ? outsourcedSet.has(String(labelText)) : Boolean(outsourcedStatus[labelText] ?? outsourcedSet.has(String(labelText))));

  // Notify parent about outsourced toggle so parent can persist this state if needed
  const handleToggleOutsourcedAndNotify = (idx, labelText) => {
    const next = !isTagOutsourced(labelText);
    if (!isOutsourcedControlled) {
      setOutsourcedStatus(prev => ({ ...prev, [labelText]: next }));
    }
    if (typeof onToggleOutsourced === 'function') {
      onToggleOutsourced(idx, next);
    }
  };

  const handleSelectAll = () => {
    const maxTags = maxTagsAllowed !== undefined ? maxTagsAllowed : Infinity;
    const nextTags = getUniqueTags([...tags, ...suggestionValues]).slice(0, maxTags);
    setTags(nextTags);
    setDuplicateError('');
    if (!disableClearOnSelect) {
      setInput('');
    }
  };

  const handleRemoveAll = () => {
    setTags([]);
    setInput('');
    setDuplicateError('');
  };

  const handleAdd = item => {
    if (!item) {
      return;
    }
    const val = typeof item === 'string' ? item : item.label || item.value;

    // Check if maxSuggestionLength limit is reached
    const maxTags = maxTagsAllowed !== undefined ? maxTagsAllowed : max === 1 ? 1 : Infinity;
    const isSingleSelection = max === 1 || maxTags === 1;

    if (tags.length >= maxTags) {
      // If only 1 tag is allowed, selecting a new one replaces the existing.
      if (!isSingleSelection) {
        return;
      }
    }

    if (isSingleSelection) {
      if (onChange) {
        onChange([val]);
      } else {
        setInternalTags([val]);
      }

      if (!disableClearOnSelect) {
        setInput('');
        setOpen(false);
      }
    } else {
      if (tags.includes(val)) {
        setDuplicateError(`"${val}" already exists`);
        setTimeout(() => setDuplicateError(''), 3000);
        return;
      }

      setDuplicateError('');
      if (onChange) {
        onChange([...tags, val]);
      } else {
        setInternalTags(prev => [...prev, val]);
      }

      if (!disableClearOnSelect) {
        setInput('');
      }
    }

    if (typeof _onAdd === 'function') {
      _onAdd(val);
    }
  };

  const handleDelete = tag => {
    if (max === 1) {
      if (onChange) {
        onChange([]);
      } else {
        setInternalTags([]);
      }
      // Clear the input display for single-selection
      setInput('');
      if (typeof onDelete === 'function') {
        onDelete(tag);
      }
      return;
    }
    // if tag no longer exists (already removed), do nothing
    if (!tags.includes(tag)) {
      return;
    }

    if (onChange) {
      const next = [...tags];
      const idx = next.indexOf(tag);
      if (idx > -1) {
        next.splice(idx, 1);
      }
      onChange(next);
    } else {
      setInternalTags(prev => {
        const next = [...prev];
        const idx = next.indexOf(tag);
        if (idx > -1) {
          next.splice(idx, 1);
        }
        return next;
      });
    }

    if (typeof onDelete === 'function') {
      onDelete(tag);
    }
  };

  // Remove tag at a specific index to avoid ambiguous removals when duplicate values exist
  const handleDeleteAtIndex = index => {
    if (max === 1) {
      if (onChange) {
        onChange([]);
      } else {
        setInternalTags([]);
      }
      // Clear the input display for single-selection
      setInput('');
      if (typeof onDelete === 'function' && tags[index]) {
        onDelete(tags[index]);
      }
      return;
    }

    if (index < 0 || index >= tags.length) {
      return;
    }

    const deletedTag = tags[index];

    if (onChange) {
      const next = [...tags];
      next.splice(index, 1);
      onChange(next);
    } else {
      setInternalTags(prev => {
        const next = [...prev];
        next.splice(index, 1);
        return next;
      });
    }

    // Drop the removed tag's outsourced flag, so re-adding the same name later
    // does not come back pre-ticked.
    const deletedLabel = getItemText(deletedTag) || (typeof deletedTag === 'string' ? deletedTag : deletedTag?.processName);
    if (deletedLabel) {
      setOutsourcedStatus(prev => {
        if (!(deletedLabel in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[deletedLabel];
        return next;
      });
    }

    if (typeof onDelete === 'function') {
      onDelete(deletedTag);
    }
  };

  const filtered = safeSuggestions.filter(s => {
    const text = getItemText(s);
    return text?.toLowerCase()?.includes(input.toLowerCase());
  });
  const showBulkActions = enableBulkActions && !isSingleSelection && (hasSuggestionValues || hasTags);
  const showSelectAllAction = showBulkActions && hasSuggestionValues && !areAllSuggestionsSelected && String(selectAllLabel).toLowerCase().includes(input.toLowerCase());
  const showRemoveAllAction = showBulkActions && hasTags && String(removeAllLabel).toLowerCase().includes(input.toLowerCase());
  const isDropdownOpen = open && (filtered.length > 0 || showSelectAllAction || showRemoveAllAction);

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <div className="input-container mb-0 position-relative" ref={containerRef}>
        <Box
          className="suggestionBx"
          ref={el => {
            anchorRef.current = el;
            setAnchorEl(el);
          }}
          sx={{
            backgroundColor:
              (textFieldProps && textFieldProps.inputProps && textFieldProps.inputProps.style && textFieldProps.inputProps.style.backgroundColor) ||
              (textFieldProps && textFieldProps.bgColor) ||
              '#FCFCFC',
            '&:focus-within input': {
              backgroundColor: '#ffffff',
            },
          }}>
          <TextField
            fullWidth
            error={Boolean(error) || Boolean(duplicateError)}
            helperText={duplicateError || error}
            label={
              <span className={`input-label ${disabled ? 'disabled-text' : ''}`}>
                {label}
                <span className="asterics">{isRequired ? '*' : null}</span>
              </span>
            }
            sx={{
              '& .MuiOutlinedInput-root': {
                height: inputType === 'search' ? '36px' : (textFieldProps && textFieldProps.multiline) || hasChips ? 'auto' : '45px',
                minHeight: hasChips ? '45px' : undefined,
                flexWrap: hasChips ? 'wrap' : undefined,
                alignItems: hasChips ? 'center' : undefined,
                gap: hasChips ? '4px' : undefined,
                paddingTop: hasChips ? '5px' : undefined,
                paddingBottom: hasChips ? '5px' : undefined,
                '& input': {
                  padding: '10px 14px',
                  boxSizing: 'border-box',
                  paddingLeft: showLeftIcon ? '30px' : '14px',
                  marginLeft: marginLeft || 0,
                  minWidth: hasChips ? '120px' : undefined,
                  flex: hasChips ? 1 : undefined,
                  fontSize: inputType === 'search' ? '11px !important' : '14px !important',
                  backgroundColor:
                    (textFieldProps && textFieldProps.inputProps && textFieldProps.inputProps.style && textFieldProps.inputProps.style.backgroundColor) ||
                    (textFieldProps && textFieldProps.bgColor) ||
                    '#FCFCFC',
                },
                '&.Mui-focused input': {
                  backgroundColor: '#ffffff',
                },
                '& fieldset': { borderWidth: '1px' },
                '&.Mui-focused fieldset': { borderWidth: '1px' },
              },
              '& .MuiInputLabel-root': {
                top: inputType === 'search' ? '-5px' : '-5px',
                fontSize: inputType === 'search' ? '12px !important' : '14px !important',
                fontFamily: 'Inter-medium',
                color: 'var(--text-3)!important',
                transition: 'transform 180ms ease, font-size 180ms ease, top 180ms ease',
              },
              '& .MuiInputLabel-shrink': { top: '0', fontSize: '15px !important', color: 'var(--heading)!important' },
              '& .MuiOutlinedInput-notchedOutline': { border: '1px solid var(--outline)', borderRadius: 'var(--radius-8)' },
            }}
            placeholder={placeholder}
            // If single selection, show the selected value inside the input
            value={isSingleSelection ? selectedValueForInput || input : input}
            onFocus={() => {
              setFocused(true);
              setOpen(true);
            }}
            onBlur={() => {
              setFocused(false);
              // If single-selection mode and user has typed something but didn't press Enter,
              // accept the typed value on blur so they don't need to press Enter explicitly.
              if (isSingleSelection && input && input.trim()) {
                // Add the input as the selected value
                handleAdd(input.trim());
              }
            }}
            onChange={e => {
              let value = e.target.value;
              // Limit input to max prop if provided (default max is 100)
              const maxLength = max || 100;
              if (value.length > maxLength) {
                value = value.slice(0, maxLength);
              }
              // Auto-capitalize the first character so the tag is saved capitalized.
              if (!disableAutoCapitalize && value.length > 0) {
                value = value.charAt(0).toUpperCase() + value.slice(1);
              }
              setInput(value);
              setOpen(true);
              if (duplicateError) {
                setDuplicateError('');
              }
            }}
            onKeyDown={e => {
              // Press Enter to add the typed text as a tag
              if (e.key === 'Enter' && input.trim()) {
                e.preventDefault();
                handleAdd(input.trim());
              } else if (e.key === 'Backspace' && !input && tags.length) {
                // If input empty and Backspace pressed, remove the last tag
                handleDelete(tags[tags.length - 1]);
              }
            }}
            slotProps={{
              input: {
                startAdornment: hasChips ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', maxWidth: '100%' }}>
                    {tags.map((tag, idx) => {
                      const labelText = typeof tag === 'string' ? tag : tag.processName || tag.label || tag.name || tag.value || '';
                      return (
                        <Chip
                          key={`${labelText}__${idx}`}
                          size="small"
                          label={labelText}
                          // Prevent the chip (and its delete icon) from blurring/refocusing the input.
                          onMouseDown={e => e.stopPropagation()}
                          onDelete={() => handleDeleteAtIndex(idx)}
                          deleteIcon={<img src={Icons.cross} alt="remove" className="icon-12" />}
                          sx={{ backgroundColor: '#F5F6FA', border: '1px solid #EBEDF3', borderRadius: '6px', fontSize: '13px' }}
                        />
                      );
                    })}
                  </Box>
                ) : null,
                endAdornment: (
                  <InputAdornment position="end">
                    {(isSingleSelection ? selectedValueForInput || input : input) ? (
                      <IconButton
                        size="small"
                        aria-label="Clear"
                        onClick={() => {
                          // Clear input and selection for single selection
                          setInput('');
                          if (isSingleSelection && (onChange || value !== undefined)) {
                            if (onChange) {
                              onChange([]);
                            }
                          }
                        }}>
                        <img src={Icons.cross} alt="" className="icon-12" />
                      </IconButton>
                    ) : null}
                  </InputAdornment>
                ),
                ...textFieldProps,
              },

              inputLabel: { shrink: focused || Boolean(input) || tags.length > 0 },
            }}
          />
        </Box>
        {subLabel ? <p className="fs-12 fw-italic-400 mb-0 margin-top-4 text-3-color">{subLabel}</p> : null}
        {!isSingleSelection && tags.length > 0 && (
          <Box ref={chipsWrapperRef} sx={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {tags.map((tag, idx) => {
              const labelText = typeof tag === 'string' ? tag : tag.processName || tag.label || tag.name || tag.value || JSON.stringify(tag);
              const isOutsourced = isTagOutsourced(labelText);

              return (
                <Box
                  key={`${labelText}__${idx}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 10px',
                    backgroundColor: '#F5F6FA',
                    border: '1px solid #EBEDF3',
                    borderRadius: '6px',
                    marginTop: '8px',
                    width: optionWidth,
                  }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <span className="fs-16 fw-500 text-1-color">{labelText}</span>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {Outsourced && (
                      <>
                        <AppIconButton
                          icon={isOutsourced ? Icons.checkSquare : Icons.uncheckSquare}
                          label={`${labelText} outsourced`}
                          iconClassName="icon-22"
                          onClick={() => handleToggleOutsourcedAndNotify(idx, labelText)}
                          role="checkbox"
                          aria-checked={isOutsourced}
                        />
                        <span className="fs-14 fw-400 text-1-color">Outsourced</span>
                      </>
                    )}
                    <AppButton leftIconStyle={'icon-14'} leftIcon={Icons.trash} onClick={() => handleDeleteAtIndex(idx)} variant="danger-link" title="Remove" size="small" />
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
        {/* Suggestion dropdown shown under the input. Click an item to add it. */}
        <Popper
          open={isDropdownOpen}
          anchorEl={anchorEl}
          style={{ zIndex: 1400 }}
          placement="bottom-start"
          // Avoid ClickAwayListener treating portaled popper clicks as outside.
          disablePortal={popperProps?.disablePortal ?? true}
          {...popperProps}
          modifiers={[
            // Follow the input on scroll (popper updates position automatically) and
            // flip above the input when there isn't enough room below it.
            { name: 'flip', enabled: true, options: { fallbackPlacements: ['top-start'] } },
            { name: 'preventOverflow', enabled: true, options: { altAxis: false, tether: false } },
            ...(popperProps?.modifiers || []),
          ]}>
          <Grow in={isDropdownOpen} style={{ transformOrigin: 'left top' }}>
            <Paper elevation={8} sx={{ minWidth: anchorEl ? anchorEl.clientWidth : 240, boxShadow: '0px 6px 20px rgba(0,0,0,0.12)' }}>
              <List dense disablePadding className="suggestion-ul" sx={{ maxHeight: '384px', overflowY: 'auto' }}>
                {showSelectAllAction && (
                  <ListItem disablePadding sx={{ borderBottom: filtered.length > 0 || showRemoveAllAction ? '1px solid #EBEDF3' : 'none' }}>
                    <ListItemButton onMouseDown={e => e.preventDefault()} onClick={handleSelectAll} sx={{ fontWeight: 600, cursor: 'pointer' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                        <span>{selectAllLabel}</span>
                        <img src={Icons.check} alt="select all" className="icon-16" />
                      </Box>
                    </ListItemButton>
                  </ListItem>
                )}
                {showRemoveAllAction && (
                  <ListItem disablePadding sx={{ borderBottom: filtered.length > 0 ? '1px solid #EBEDF3' : 'none' }}>
                    <ListItemButton onMouseDown={e => e.preventDefault()} onClick={handleRemoveAll} sx={{ fontWeight: 600, cursor: 'pointer' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                        <span>{removeAllLabel}</span>
                        <img src={Icons.cross} alt="remove all" className="icon-12" />
                      </Box>
                    </ListItemButton>
                  </ListItem>
                )}
                {filtered.map((s, idx) => {
                  const text = getItemText(s);
                  const isSelected = tags.includes(text);
                  return (
                    // Material-style clickable list item
                    <ListItem
                      key={`${text}__${idx}`}
                      disablePadding
                      sx={{
                        backgroundColor: isSelected ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                      }}>
                      <ListItemButton
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          if (isSelected) {
                            handleDelete(text);
                          } else {
                            handleAdd(text);
                          }
                        }}
                        sx={{
                          fontWeight: isSelected ? 500 : 400,
                          cursor: 'pointer',
                          opacity: isSelected ? 0.7 : 1,
                          minHeight: 48,
                          '&:hover': {
                            backgroundColor: isSelected ? 'transparent' : 'rgba(0, 0, 0, 0.04)',
                          },
                        }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                          <span>{text}</span>
                          {isSelected && <img src={Icons.check} alt="" className="icon-16" />}
                        </Box>
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Paper>
          </Grow>
        </Popper>
      </div>
    </ClickAwayListener>
  );
};

AppSuggestionInput.propTypes = {
  suggestions: PropTypes.array,
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  label: PropTypes.string,
  initialTags: PropTypes.array,
  maxSuggestions: PropTypes.number,
  disableClearOnSelect: PropTypes.bool,
  chipProps: PropTypes.object,
  textFieldProps: PropTypes.object,
  popperProps: PropTypes.object,
  onAdd: PropTypes.func,
  onDelete: PropTypes.func,
  onToggleOutsourced: PropTypes.func,
  outsourcedValues: PropTypes.array,
  error: PropTypes.string,
  subLabel: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  max: PropTypes.number,
  maxSuggestion: PropTypes.number,
  maxSuggestionLength: PropTypes.number,
  enableBulkActions: PropTypes.bool,
  selectAllLabel: PropTypes.string,
  removeAllLabel: PropTypes.string,
};

export default AppSuggestionInput;

/*
Example usage:

import React, { useState } from 'react';
import { AppSuggestionInput } from './components/base';

function Example() {
  const suggestions = ['ISO 9001', 'ISO 14001', 'ISO 45001', 'ISO 27001'];
  const [tags, setTags] = useState(['ISO 9001']);

  return (
    <AppSuggestionInput
      label="Standards"
      placeholder="Add standards or choose suggestions"
      suggestions={suggestions}
      value={tags}
      onChange={setTags}
      maxSuggestions={6}
    />
  );
}

*/
