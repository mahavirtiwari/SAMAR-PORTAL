import { Box, TextField, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

// Helper function to extract filename from a path
const extractFileName = path => {
  if (!path) {
    return '';
  }
  // Handle both forward slashes and backslashes
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || '';
};

const AppFileUpload = ({
  label = 'Upload File',
  maxSizeMB = 5,
  accept,
  onChange,
  value,
  inputType,
  leftIcon,
  rightIcon,
  leftIconStyle,
  rightIconStyle,
  customInputClass,
  additionalInfoLabel,
  isRequired,
  error,
  subLabel,
}) => {
  // Derive filename from value - extract just the filename if value is a path string
  const getDisplayFileName = val => {
    if (!val) {
      return '';
    }
    if (typeof val === 'string') {
      return extractFileName(val);
    }
    return val.name || '';
  };

  const [fileName, setFileName] = useState(getDisplayFileName(value));
  const [fileError, setFileError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef(null);

  // Update fileName when value prop changes (e.g., when draft data is loaded)
  useEffect(() => {
    setFileName(getDisplayFileName(value));
  }, [value]);

  // Clear file error when parent error changes or value is reset
  useEffect(() => {
    if (!value) {
      setFileError('');
    }
  }, [value]);

  const handleFileChange = e => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    // Clear previous file error
    setFileError('');

    // Validate file extension against accept prop (e.g. ".xlsx,.xls,.csv")
    if (accept) {
      const allowedExtensions = accept.split(',').map(ext => ext.trim().toLowerCase().replace(/^\./, ''));
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (fileExtension && !allowedExtensions.includes(fileExtension)) {
        const formattedExts = allowedExtensions.map(ext => `.${ext}`).join(', ');
        setFileError(`Unsupported file type. Allowed formats: ${formattedExts}`);
        e.target.value = '';
        onChange && onChange(null);
        setFileName('');
        return;
      }
    }

    // Double-extension security check (e.g., malware.php.jpg)
    const DANGEROUS_EXTENSIONS = [
      'php',
      'php3',
      'php4',
      'php5',
      'php7',
      'phtml',
      'phar',
      'exe',
      'bat',
      'cmd',
      'sh',
      'bash',
      'zsh',
      'py',
      'rb',
      'pl',
      'js',
      'mjs',
      'asp',
      'aspx',
      'jsp',
      'cfm',
      'htaccess',
      'svg',
      'html',
      'htm',
    ];
    const nameParts = file?.name?.split('.');
    if (nameParts.length > 2) {
      for (let i = 1; i < nameParts.length - 1; i++) {
        if (DANGEROUS_EXTENSIONS.includes(nameParts[i].toLowerCase())) {
          setFileError('File contains a blocked extension in its name. Double extensions are not permitted.');
          e.target.value = '';
          onChange && onChange(null);
          setFileName('');
          return;
        }
      }
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      setFileError(`File size cannot exceed ${maxSizeMB}MB.`);
      e.target.value = '';
      onChange && onChange(null);
      setFileName('');
      return;
    }
    setFileName(file.name);
    onChange && onChange(file);
  };

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  const displayError = fileError || error;

  return (
    <Box className={'app-file-upload input-container'} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ position: 'relative', width: '100%' }}>
        <TextField
          id="file-upload-input"
          type="text"
          value={fileName}
          error={!!displayError}
          label={
            <span className="input-label">
              {label}
              {additionalInfoLabel && <span className="text-3-color"> ({additionalInfoLabel})</span>}
              <span className="asterics">{isRequired ? '*' : null}</span>
            </span>
          }
          placeholder={fileName ? fileName : 'Choose File'}
          onFocus={handleFocus}
          onBlur={handleBlur}
          sx={{
            width: '100%',
            height: inputType === 'search' ? 36 : 45,
            fontSize: inputType === 'search' ? 11 : 14,
            '& .MuiOutlinedInput-root': {
              height: inputType === 'search' ? 36 : 45,
              fontSize: inputType === 'search' ? 11 : 14,
            },
            '& .MuiInputLabel-root': {
              top: inputType === 'search' ? '-5px' : '-5px',
              fontSize: inputType === 'search' ? '12px' : '14px',
              fontFamily: 'Inter-medium',
              color: 'var(--text-3)',
            },
            '& .MuiInputLabel-shrink': {
              top: '0',
              fontSize: '16px',
              color: 'var(--text-1)!important',
            },
            '& .MuiOutlinedInput-notchedOutline': {
              border: '1px solid var(--outline)',
              borderRadius: 'var(--radius-8)',
            },
          }}
          className={customInputClass}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          slotProps={{
            input: {
              readOnly: true,
              endAdornment:
                rightIcon && isFocused ? (
                  <span style={{ ...rightIconStyle }}>
                    <img src={rightIcon} alt="Right Icon" style={{ width: 20, height: 20 }} />
                  </span>
                ) : null,
              startAdornment:
                leftIcon && isFocused ? (
                  <span style={{ ...leftIconStyle }}>
                    <img src={leftIcon} alt="Left Icon" style={{ width: 20, height: 20 }} />
                  </span>
                ) : null,
            },
          }}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept={accept || '.jpg,.jpeg,.png,.pdf'}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleFileChange}
        />
      </Box>
      <Typography variant="caption" color="text.secondary">
        {subLabel || `Only .jpg, .jpeg, .png, .pdf files. Max file size ${maxSizeMB}MB.`}
      </Typography>
      {displayError && <div className="error-text">{displayError}</div>}
    </Box>
  );
};

export default AppFileUpload;
