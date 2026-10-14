import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { parseIndianLandline } from '../../../utils/FormatIndianLandline';
import { parseIndianMobile } from '../../../utils/FormatIndianMobile';
import { formatNumber, parseNumericOrNull } from '../../../utils/formatters';

const AppInput = ({
  label,
  placeholder,
  onChange = () => undefined,
  inputStyle = {},
  rightIcon,
  leftIcon,
  onRightIconClick,
  error,
  name,
  onBlur,
  isRequired,
  additionalInfoLabel,
  color,
  bgColor,
  leftIconStyle,
  customInputClass,
  marginLeft,
  inputType,
  subLabel,
  passwordIcon,
  type,
  disabled,
  maxLength,
  passwordIconOnClick,
  className = '',
  phoneNumberFormat = false,
  landLineFormat = false,
  feeValidation = false,
  percentageFormat = false,
  upperCase = false,
  stripWhitespace = false,
  numericCase = false,
  alphaOnly = false,
  formatOnBlur = false,
  disableAutoCapitalize = false,
  value = '',
  sx,
  // Legacy MUI TextField prop names, still used by callers. MUI v9 removed them
  // from TextField, so they are folded into slotProps below instead of being
  // spread onto the DOM.
  InputProps,
  inputProps,
  slotProps,
  // Width of the outer container; not a TextField prop.
  customWidth,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = e => {
    setIsFocused(true);
    if (props.onFocus) {
      props.onFocus(e);
    }
  };

  const handleBlur = e => {
    setIsFocused(false);
    if (onBlur) {
      onBlur(e);
    }
  };

  // Show leftIcon if input is focused or has value (label is shrunk)
  const showLeftIcon = leftIcon && (isFocused || !!value);

  const handleInputChange = e => {
    let val = e.target.value;

    // Strip HTML tags from all text inputs to prevent XSS
    if (typeof val === 'string' && !type?.includes('password')) {
      const stripped = val.replace(/<[^>]*>/g, '');
      if (stripped !== val) {
        val = stripped;
        e = { ...e, target: { ...e.target, value: val } };
      }
    }

    // Auto-capitalize the first character of free-text fields, on by default.
    // Runs before the other transforms so the capitalized value reaches form
    // state (what gets submitted) — CSS text-transform wouldn't. Skipped where
    // it's wrong or a no-op: password/email inputs, url/email/username-style
    // names, search boxes, upper-cased code fields (PAN/GST/SAMAR ID) and
    // numeric/phone/fee/percentage fields (no letters to capitalize). The
    // disableAutoCapitalize prop is the per-field escape hatch.
    const nameStr = typeof name === 'string' ? name.toLowerCase() : '';
    const skipCapitalize =
      disableAutoCapitalize ||
      type === 'email' ||
      type?.includes('password') ||
      inputType === 'search' ||
      upperCase ||
      numericCase ||
      phoneNumberFormat ||
      landLineFormat ||
      feeValidation ||
      percentageFormat ||
      /email|url|website|weblink|username|password/.test(nameStr);
    if (!skipCapitalize && typeof val === 'string' && val.length > 0) {
      const capitalized = val.charAt(0).toUpperCase() + val.slice(1);
      if (capitalized !== val) {
        val = capitalized;
        e = { ...e, target: { ...e.target, value: val } };
      }
    }

    // Submit-time normalization. CSS text-transform alone doesn't reach
    // form state, so server-side regex validation fails on lowercase /
    // spaced PAN, SAMAR ID, GST. upperCase handles casing; stripWhitespace
    // handles space-stripping — kept separate so name fields can use
    // upperCase without losing their spaces. Must happen before any
    // downstream early-return so all paths see the normalized value.
    if (upperCase && typeof val === 'string') {
      const upper = val.toUpperCase();
      if (upper !== val) {
        val = upper;
        e = { ...e, target: { ...e.target, value: val } };
      }
    }

    if (stripWhitespace && typeof val === 'string') {
      const trimmed = val.replace(/\s+/g, '');
      if (trimmed !== val) {
        val = trimmed;
        e = { ...e, target: { ...e.target, value: val } };
      }
    }

    // Handle alpha only input mode (Restricts special characters like . , etc)
    if (alphaOnly) {
      const alphaVal = val.replace(/[^a-zA-Z ]/g, '');
      if (alphaVal !== val) {
        val = alphaVal;
        const syntheticEvent = { ...e, target: { ...e.target, value: val } };
        if (onChange) {
          onChange(syntheticEvent);
        }
        return;
      }
    }

    // If numericCase prop is set, remove non-digit characters immediately
    if (numericCase && !phoneNumberFormat && !feeValidation && !percentageFormat && !landLineFormat) {
      const digitsOnly = val.replace(/\D+/g, '');
      if (digitsOnly !== val) {
        val = digitsOnly;
        // create synthetic event with sanitized value
        const syntheticEvent = { ...e, target: { ...e.target, value: val } };
        if (onChange) {
          onChange(syntheticEvent);
        }
        return;
      }
    }

    // Handle phone number input mode
    if (phoneNumberFormat) {
      const digits = parseIndianMobile(val);
      const syntheticEvent = { ...e, target: { ...e.target, value: digits } };
      if (onChange) {
        onChange(syntheticEvent);
      }
      return;
    }

    // Handle landline number input mode
    if (landLineFormat) {
      const digits = parseIndianLandline(val);
      const syntheticEvent = { ...e, target: { ...e.target, value: digits } };
      if (onChange) {
        onChange(syntheticEvent);
      }
      return;
    }

    // Handle fee validation mode (max 6 digits before decimal, 2 after)
    if (feeValidation) {
      // Allow only digits and one decimal point
      let sanitized = val.replace(/[^0-9.]/g, '');

      // Handle multiple decimal points - keep only first one
      const firstDotIndex = sanitized.indexOf('.');
      if (firstDotIndex !== -1) {
        sanitized = sanitized.substring(0, firstDotIndex + 1) + sanitized.substring(firstDotIndex + 1).replace(/\./g, '');
      }

      const parts = sanitized.split('.');
      let integerPart = parts[0] || '';
      let decimalPart = parts[1];

      // Restrict integer part to 6 digits
      if (integerPart.length > 6) {
        integerPart = integerPart.substring(0, 6);
      }

      // Restrict decimal part to 2 digits
      if (decimalPart !== undefined && decimalPart.length > 2) {
        decimalPart = decimalPart.substring(0, 2);
      }

      // Build the validated value
      let validatedValue = integerPart;
      if (parts.length === 2) {
        validatedValue += '.' + (decimalPart || '');
      }

      const syntheticEvent = { ...e, target: { ...e.target, value: validatedValue } };
      if (onChange) {
        onChange(syntheticEvent);
      }
      return;
    }

    // Handle percentage format mode (max 3 digits before decimal, 2 after, max value 100)
    if (percentageFormat) {
      // Allow only digits and one decimal point
      let sanitized = val.replace(/[^0-9.]/g, '');

      // Handle multiple decimal points - keep only first one
      const firstDotIndex = sanitized.indexOf('.');
      if (firstDotIndex !== -1) {
        sanitized = sanitized.substring(0, firstDotIndex + 1) + sanitized.substring(firstDotIndex + 1).replace(/\./g, '');
      }

      const parts = sanitized.split('.');
      let integerPart = parts[0] || '';
      let decimalPart = parts[1];

      // Restrict integer part to 3 digits (max 100%)
      if (integerPart.length > 3) {
        integerPart = integerPart.substring(0, 3);
      }

      // Restrict decimal part to 2 digits
      if (decimalPart !== undefined && decimalPart.length > 2) {
        decimalPart = decimalPart.substring(0, 2);
      }

      // Build the value for validation
      let validatedValue = integerPart;
      if (parts.length === 2) {
        validatedValue += '.' + (decimalPart || '');
      }

      // Validate that the value doesn't exceed 100
      const numericValue = parseFloat(validatedValue);
      if (numericValue > 100) {
        // Don't update the value if it exceeds 100
        return;
      }

      const syntheticEvent = { ...e, target: { ...e.target, value: validatedValue } };
      if (onChange) {
        onChange(syntheticEvent);
      }
      return;
    }

    if (maxLength && typeof maxLength === 'number') {
      if (val.length > maxLength) {
        val = val.slice(0, maxLength);
        // create a synthetic event to keep onChange contract
        const syntheticEvent = { ...e, target: { ...e.target, value: val } };
        if (onChange) {
          onChange(syntheticEvent);
        }
        return;
      }
    }
    if (onChange) {
      const finalEvent = {
        ...e,
        target: {
          ...e.target,
          name,
          value: val,
        },
      };
      onChange(finalEvent);
    }
  };

  const handleClearClick = e => {
    // Prevent parent handlers
    e.stopPropagation();
    if (disabled) {
      return;
    }

    // For phone number formatting, pass empty digits
    if (phoneNumberFormat || landLineFormat) {
      const syntheticEvent = { target: { ...{ name }, value: '' } };
      if (onChange) {
        onChange(syntheticEvent);
      }
      return;
    }

    // Create synthetic event matching onChange contract
    const syntheticEvent = { target: { ...{ name }, value: '' } };
    if (onChange) {
      onChange(syntheticEvent);
    }
  };

  // Compute display value - optionally format numeric values when input is not focused
  let displayValue = value;
  if (!phoneNumberFormat && !landLineFormat && formatOnBlur && !isFocused) {
    const parsed = parseNumericOrNull(value);
    displayValue = parsed == null ? value : formatNumber(parsed);
  } else if (phoneNumberFormat) {
    displayValue = value;
  } else if (landLineFormat) {
    displayValue = value;
  }
  // Compute effective maxLength for phone input (10 digits + 1 space), fee validation (9 chars: 6 digits + 1 dot + 2 decimals), percentage (5 chars: 2 digits + 1 dot + 2 decimals), search inputs default to 50
  const effectiveMaxLength = phoneNumberFormat ? 11 : landLineFormat ? 14 : feeValidation ? 9 : percentageFormat ? 5 : inputType === 'search' ? maxLength || 50 : maxLength;
  // Compute effective inputMode
  // Determine effective inputMode, give priority to phone/fee/percentage. If numericCase requested, use numeric input mode.
  const effectiveInputMode = phoneNumberFormat || landLineFormat ? 'numeric' : feeValidation || percentageFormat ? 'decimal' : numericCase ? 'numeric' : undefined;

  return (
    <>
      <div className={`input-container ${inputType === 'search' ? 'search-Container' : ''} mb-0 position-relative${className ? ' ' + className : ''}`} style={{ width: customWidth }}>
        <TextField
          id="outlined-textarea"
          type={type || 'text'}
          name={name}
          disabled={disabled}
          maxLength={maxLength}
          label={
            <span className={`input-label ${disabled ? 'disabled-text' : ''}`}>
              {label}
              {additionalInfoLabel && <span className="text-3-color"> ({additionalInfoLabel})</span>}
              <span className="asterics">{isRequired ? '*' : null}</span>
            </span>
          }
          placeholder={placeholder}
          multiline={!!props.multiline}
          error={!!error}
          className={customInputClass || ''}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          sx={{
            '.input-search-document & input': {
              marginLeft: '0 !important',
            },
            backgroundColor: bgColor || 'inherit',
            '& .MuiOutlinedInput-root': {
              height: inputType === 'search' ? '40px' : props.multiline ? 'auto' : '45px',
              '& input': {
                padding: '10px 14px',
                boxSizing: 'border-box',
                paddingLeft: showLeftIcon ? '20px' : '14px',
                marginLeft: marginLeft || 0,
                fontSize: inputType === 'search' ? '12px !important' : '14px !important',
                backgroundColor: bgColor || '#FCFCFC',
                ...(upperCase ? { textTransform: 'uppercase' } : {}),
              },
              '& input::placeholder': {
                ...(upperCase ? { textTransform: 'none' } : {}),
              },
              '& textarea': {
                backgroundColor: bgColor || '#FCFCFC',
              },
              '&.Mui-focused input': {
                backgroundColor: '#ffffff',
              },
              '&.Mui-focused textarea': {
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
            },
            '& .MuiInputLabel-shrink': { top: '0', fontSize: '16px !important', color: 'var(--heading)!important' },
            '& .MuiOutlinedInput-notchedOutline': { border: '1px solid var(--outline)', borderRadius: 'var(--radius-8)' },
          }}
          {...props}
          slotProps={{
            ...slotProps,
            input: {
              endAdornment:
                // If rightIcon provided, show it. If inputType is 'search' and there's a value
                // and no explicit onRightIconClick handler, use the right icon as a clear button.
                rightIcon ? (
                  <div
                    className="right-icon-button"
                    onClick={e => {
                      if (disabled) {
                        return;
                      }
                      if (onRightIconClick) {
                        return onRightIconClick(e);
                      }
                      if (inputType === 'search' && displayValue) {
                        return handleClearClick(e);
                      }
                    }}
                    style={{ cursor: onRightIconClick || (inputType === 'search' && displayValue) ? 'pointer' : 'default' }}>
                    <img className="img-fluid" src={rightIcon} alt="Right Icon" />
                  </div>
                ) : null,
              startAdornment: showLeftIcon ? (
                <div className="left-icon-button" style={leftIconStyle}>
                  <img className="img-fluid" src={leftIcon} alt="Left Icon" />
                </div>
              ) : null,
              classes: { input: 'input-style' },
              ...InputProps,
              ...slotProps?.input,
            },
            htmlInput: {
              ...inputStyle,
              maxLength: effectiveMaxLength,
              inputMode: effectiveInputMode,
              style: { backgroundColor: bgColor, color: color },
              ...inputProps,
              ...slotProps?.htmlInput,
            },
          }}
        />
        {/* If no custom rightIcon provided, show inline clear button for search inputs when value exists */}
        {inputType === 'search' && !disabled && !rightIcon && displayValue ? (
          <div className="right-icon-button clear-button" onClick={handleClearClick} style={{ cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 6L18 18" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ) : null}
        {passwordIcon && (
          <div className="password-eye">
            <img src={passwordIcon} alt="eye" className="icon-16" onClick={passwordIconOnClick} />
          </div>
        )}
        {subLabel ? <p className="fs-12 fw-italic-400 mb-0 margin-top-4 text-3-color">{subLabel}</p> : null}
      </div>
      {error && <span className="error-text margin-top-4">{error}</span>}
    </>
  );
};

export default AppInput;
