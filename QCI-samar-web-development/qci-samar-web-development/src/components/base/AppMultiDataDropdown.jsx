import Popper from '@mui/material/Popper';
import TextField from '@mui/material/TextField';
import PropTypes from 'prop-types';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Icons from '../../constants/Icons';
import AppAvatar from './AppAvatar';

// Context logic moved from DropdownOpenContext.js
const DropdownOpenContext = createContext();
export function DropdownOpenProvider({ children }) {
  const [openDropdownId, setOpenDropdownId] = useState(null);
  return <DropdownOpenContext.Provider value={{ openDropdownId, setOpenDropdownId }}>{children}</DropdownOpenContext.Provider>;
}
export function useDropdownOpen() {
  return useContext(DropdownOpenContext);
}

/**
 * USAGE EXAMPLES:
 *
 * // Single Select Dropdown
 * <AppMultiDataDropdown
 *   label="Lead Assessor"
 *   placeholder="Select Lead Assessor"
 *   value={leadAssessor} // array with one selected id, e.g. ['BG']
 *   onChange={setLeadAssessor}
 *   options={assessorOptions}
 *   singleSelect
 *   isRequired
 * />
 *
 * // Multi Select Dropdown
 * <AppMultiDataDropdown
 *   label="Co-Assessors"
 *   placeholder="Select Assessor(s)"
 *   value={demoSelected} // array with multiple selected ids, e.g. ['BG', 'SJ']
 *   onChange={setDemoSelected}
 *   options={assessorOptions}
 *   isRequired
 * />
 */

function AppMultiDataDropdown({ label = '', placeholder = 'Select an option', options, value, onChange, customDropdownClass = '', singleSelect = false, note = '' }) {
  const inputRef = useRef(null);
  const [anchorEl, setAnchorEl] = useState(null);
  useEffect(() => {
    setAnchorEl(inputRef.current);
  }, []);
  const containerRef = useRef(null);
  const [isOpenLocal, setIsOpenLocal] = useState(false);
  const [labelShrink, setLabelShrink] = useState(false);
  const isOpen = isOpenLocal;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handleClickOutside(event) {
      // Ignore click if inside dropdown list
      const dropdownList = document.querySelector('.app-dropdown-list');
      if ((containerRef.current && containerRef.current.contains(event.target)) || (dropdownList && dropdownList.contains(event.target))) {
        return;
      }
      setIsOpenLocal(false);
    }
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen]);

  // Defensive wrappers for value and options
  const safeValue = Array.isArray(value) ? value : [];
  const safeOptions = Array.isArray(options) ? options : [];

  const handleSelect = option => {
    if (singleSelect) {
      onChange([option]);
      setIsOpenLocal(false);
      setLabelShrink(true);
    } else {
      let newValue;
      if (safeValue.includes(option)) {
        newValue = safeValue.filter(item => item !== option);
      } else {
        newValue = [...safeValue, option];
      }
      onChange(newValue);
      setLabelShrink(newValue.length > 0);
    }
  };

  return (
    <div className="app-dropdown-container" ref={containerRef}>
      <TextField
        sx={{
          top: '-5px',
          fontSize: '14px !important',
          fontFamily: 'Inter-medium',
          //   backgroundColor: bgColor || 'inherit',
          color: 'var(--text-3) !important',
          padding: '0 4px',
          // '&.MuiInputLabel-shrink': {
          //   top: '0',
          //   fontSize: '16px',
          //   color: 'var(--text-1)!important',
          // },
        }}
        label={label}
        inputType="search"
        value={(() => {
          if (singleSelect && value.length > 0) {
            const option = options.find(o => o.id === value[0]);
            return option ? option.name : '';
          }
          if (!singleSelect && value.length > 0) {
            return value
              .map(id => {
                const option = options.find(o => o.id === id);
                return option ? option.name : '';
              })
              .filter(Boolean)
              .join(', ');
          }
          return '';
        })()}
        placeholder={placeholder}
        onClick={() => {
          if (isOpen) {
            setIsOpenLocal(false);
          } else {
            setIsOpenLocal(true);
            setLabelShrink(true);
          }
        }}
        className={`input-style${customDropdownClass ? ' ' + customDropdownClass : ''}`}
        variant="outlined"
        InputProps={{
          readOnly: true,
          endAdornment: (
            <img
              src={isOpen ? Icons.openDrowpDownArrow : Icons.closeDropDownIcon}
              alt={isOpen ? 'Dropdown Open Arrow' : 'Dropdown Close Arrow'}
              className="dropdown-arrow"
              style={{ cursor: 'pointer' }}
            />
          ),
          style: { cursor: 'pointer', background: '#fff', height: 45 },
        }}
        InputLabelProps={{ shrink: labelShrink || isOpen || (singleSelect ? value.length > 0 : value.length > 0) }}
        onBlur={() => {
          if (!isOpen) {
            setLabelShrink(singleSelect && value.length > 0);
          }
        }}
        inputRef={inputRef}
      />
      <Popper open={isOpen} anchorEl={anchorEl} placement="bottom-start" style={{ zIndex: 1300 }}>
        {isOpen && (
          <div className="app-dropdown-list" role="listbox">
            <div style={{ padding: 8 }}>
              <input type="text" placeholder="Search options" className="app-dropdown-list-search" />
              {note && <p className="app-dropdown-note">{note}</p>}
            </div>
            <div className="app-dropdown-options">
              {safeOptions.map(option => (
                <div
                  key={option.id}
                  className={`app-dropdown-option${safeValue.includes(option.id) ? ' selected' : ''}`}
                  onClick={() => {
                    handleSelect(option.id);
                    setIsOpenLocal(false);
                  }}
                  role="option"
                  aria-selected={safeValue.includes(option.id)}>
                  <AppAvatar alt={option.name} size="28" role={option.role} style={{ marginRight: 14 }}>
                    {option.initials}
                  </AppAvatar>
                  <div className="app-dropdown-option-content">
                    <div className={`app-dropdown-option-name${safeValue.includes(option.id) ? ' selected' : ''}`}>{option.name}</div>
                    {/* <div className="app-dropdown-option-role">{option.role}</div> */}
                  </div>
                  <div className="app-dropdown-option-location">{option.location}</div>
                  {/* <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className={`app-dropdown-option-status ${option.statusColor === 'green' ? 'green' : 'red'}`}>
                    {option.statusColor === 'green' ? <img src={Icons.availableTick} alt="Available" className="icon-18" /> : <img src={Icons.unavailableIcon} alt="Unavailable" className="icon-18" />}
                    {option.status}
                  </span>
                </div> */}
                </div>
              ))}
            </div>
          </div>
        )}
      </Popper>
    </div>
  );
}

AppMultiDataDropdown.propTypes = {
  label: PropTypes.string,
  placeholder: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      role: PropTypes.string.isRequired,
      location: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
      statusColor: PropTypes.string,
      initials: PropTypes.string.isRequired,
      avatar: PropTypes.string,
      highlight: PropTypes.bool,
    }),
  ).isRequired,
  value: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  isRequired: PropTypes.bool,
  singleSelect: PropTypes.bool,
};

export default AppMultiDataDropdown;
