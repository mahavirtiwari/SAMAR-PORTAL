// import ClearIcon from '@mui/icons-material/Clear';
import { ClickAwayListener } from '@mui/material';
import Box from '@mui/material/Box';
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
const AppSuggestionSingleSelect = ({
  suggestions = [],
  value,
  onChange,
  placeholder = 'Type to search...',
  label = '',
  disabled,
  isRequired,
  maxSuggestions = 8,
  disableClearOnSelect = false,
  chipProps = {},
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
  optionWidth = '50%',
}) => {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  const anchorRef = useRef(null);
  // store anchor element in state so we don't read ref.current during render
  const [anchorEl, setAnchorEl] = useState(null);
  const containerRef = useRef(null);
  const _chipsWrapperRef = useRef(null);
  // internal tags state used when `value` prop is not provided (uncontrolled mode)
  const [internalTags, setInternalTags] = useState(initialTags || []);
  // state to track outsourced status for each tag by index
  const [_outsourcedStatus, setOutsourcedStatus] = useState({});

  // Derive outsourcedSet from outsourcedValues prop without setState
  const _outsourcedSet = outsourcedValues && Array.isArray(outsourcedValues) ? new Set(outsourcedValues.map(String)) : new Set();

  // unified tags array: prefer controlled `value`, otherwise use internal state
  const tags = value !== undefined && value !== null ? (Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []) : internalTags;

  const _maxTagsAllowed = maxSuggestionLength ?? maxSuggestion;

  const _handleToggleOutsourced = idx => {
    setOutsourcedStatus(prev => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };
  // Notify parent about outsourced toggle so parent can persist this state if needed
  const _handleToggleOutsourcedAndNotify = idx => {
    setOutsourcedStatus(prev => {
      const next = { ...prev, [idx]: !prev[idx] };
      if (typeof onToggleOutsourced === 'function') {
        onToggleOutsourced(idx, Boolean(next[idx]));
      }
      return next;
    });
  };

  const handleAdd = item => {
    if (!item) {
      return;
    }
    const val = typeof item === 'string' ? item : item.label || item.value;

    // Always treat as single selection - replace existing value
    if (onChange) {
      onChange([val]);
    } else {
      setInternalTags([val]);
    }

    if (!disableClearOnSelect) {
      setInput('');
      setOpen(false);
      setFocused(false);
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
  const _handleDeleteAtIndex = index => {
    if (max === 1) {
      if (onChange) {
        onChange([]);
      } else {
        setInternalTags([]);
      }
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

    if (typeof onDelete === 'function') {
      onDelete(deletedTag);
    }
  };

  const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];
  // Show every matching suggestion; the dropdown caps the *visible* height to 8
  // rows (scroll for the rest), so it stays consistent with the multi-select.
  const filtered = safeSuggestions.filter(s => {
    const text = typeof s === 'string' ? s : s.label || s.value;
    return text?.toLowerCase()?.includes(input.toLowerCase());
  });

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
                height: inputType === 'search' ? '36px' : textFieldProps && textFieldProps.multiline ? 'auto' : '45px',
                '& input': {
                  padding: '10px 14px',
                  boxSizing: 'border-box',
                  paddingLeft: showLeftIcon ? '30px' : '14px',
                  marginLeft: marginLeft || 0,
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
            value={input || (tags.length > 0 ? (typeof tags[0] === 'string' ? tags[0] : tags[0].label || tags[0].value || '') : '')}
            onFocus={() => {
              setFocused(true);
              setOpen(true);
            }}
            onBlur={() => setFocused(false)}
            onChange={e => {
              let value = e.target.value;
              // Limit input to max prop if provided (default max is 100)
              const maxLength = max || 100;
              if (value.length > maxLength) {
                value = value.slice(0, maxLength);
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
                startAdornment: null,
                endAdornment: (
                  <InputAdornment position="end">
                    {input || tags.length > 0 ? (
                      <div className="cross-icon-wrapper">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setInput('');
                            if (onChange) {
                              onChange([]);
                            } else {
                              setInternalTags([]);
                            }
                          }}>
                          <img src={Icons.cross} alt="clear" className="icon-14" />
                        </IconButton>
                      </div>
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
        {/* Suggestion dropdown */}
        <Popper open={open && filtered.length > 0} anchorEl={anchorEl} style={{ zIndex: 1400 }} placement="bottom-start" disablePortal={popperProps?.disablePortal ?? true} {...popperProps}>
          <Grow in={open && filtered.length > 0} style={{ transformOrigin: 'left top' }}>
            <Paper elevation={8} sx={{ minWidth: anchorEl ? anchorEl.clientWidth : 240, boxShadow: '0px 6px 20px rgba(0,0,0,0.12)' }}>
              <List dense disablePadding className="suggestion-ul" sx={{ maxHeight: '384px', overflowY: 'auto' }}>
                {filtered.map((s, idx) => {
                  const text = typeof s === 'string' ? s : s.label || s.value;
                  const isSelected = tags.includes(text);
                  return (
                    <ListItem
                      key={`${text}__${idx}`}
                      disablePadding
                      sx={{
                        backgroundColor: isSelected ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                      }}>
                      <ListItemButton
                        onClick={() => {
                          handleAdd(text);
                        }}
                        sx={{
                          fontWeight: isSelected ? 500 : 400,
                          cursor: 'pointer',
                          opacity: isSelected ? 0.7 : 1,
                          minHeight: 48,
                          '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                          },
                        }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                          <span>{text}</span>
                          {isSelected && <img src={Icons.check} alt="check" className="icon-16" />}
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

AppSuggestionSingleSelect.propTypes = {
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
};

export default AppSuggestionSingleSelect;

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
