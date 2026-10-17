import { Button, ClickAwayListener, Paper, Popper } from '@mui/material';
import { MultiSectionDigitalClock } from '@mui/x-date-pickers/MultiSectionDigitalClock';
import dayjs from 'dayjs';
import { useRef, useState } from 'react';
import Icons from '../../constants/Icons';
import { formatTime } from '../../utils/formatters';
import AppInput from './textInput/AppInput';

// Accepts the shapes callers pass ('HH:mm', 'HH:mm:ss', ISO string, Date, dayjs)
// and returns a dayjs on today's date, or null.
const parseToDayjs = v => {
  if (!v && v !== 0) {
    return null;
  }
  if (dayjs.isDayjs(v)) {
    return v;
  }
  if (v instanceof Date) {
    return dayjs(v);
  }
  if (typeof v === 'string') {
    const m = v.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      return dayjs()
        .hour(Number.parseInt(m[1], 10))
        .minute(Number.parseInt(m[2], 10))
        .second(m[3] ? Number.parseInt(m[3], 10) : 0)
        .millisecond(0);
    }
    const iso = dayjs(v);
    return iso.isValid() ? iso : null;
  }
  return null;
};

/**
 * Time field: a read-only box that opens an hours / minutes / AM-PM picker
 * underneath, the same way AppDatePicker opens its calendar. Emits the time as
 * 24-hour `HH:mm`, which is what the forms validate and send.
 *
 * (MUI X v9 dropped the plain-input field that the previous version plugged
 * AppInput into, which made every page using it crash on open.)
 */
const AppTimePicker = ({ label, value, onChange, placeholder, error, name, isRequired, minTime, maxTime, subLabel, ...props }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const triggerRef = useRef(null);
  const parsedValue = parseToDayjs(value);

  const handleOpen = event => {
    triggerRef.current = event.currentTarget;
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const closeAndRefocus = () => {
    handleClose();
    triggerRef.current?.focus?.();
  };

  const handleFieldKeyDown = event => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      handleOpen(event);
    }
  };

  const handleTimeChange = newTime => {
    onChange?.(newTime && newTime.isValid() ? newTime.format('HH:mm') : '');
  };

  return (
    <div className="timePicker-container">
      <AppInput
        label={label}
        placeholder={placeholder}
        name={name}
        // Shown in 12-hour format with AM / PM for readability.
        value={value ? formatTime(value) : ''}
        readOnly
        error={error}
        isRequired={isRequired}
        subLabel={subLabel}
        onClick={handleOpen}
        onKeyDown={handleFieldKeyDown}
        passwordIcon={Icons.calendar}
        passwordIconOnClick={handleOpen}
        passwordToggleLabel={label ? `Choose ${label}` : 'Choose time'}
        autoComplete="off"
        inputProps={{ autoComplete: 'off', style: { cursor: 'pointer' } }}
        {...props}
      />

      <Popper open={Boolean(anchorEl)} anchorEl={anchorEl} placement="bottom-start" disablePortal sx={{ zIndex: 1300 }}>
        <ClickAwayListener onClickAway={handleClose}>
          <Paper
            elevation={3}
            sx={{ mt: 1, borderRadius: 2, overflow: 'hidden' }}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                closeAndRefocus();
              }
            }}>
            <MultiSectionDigitalClock
              autoFocus
              ampm
              value={parsedValue}
              onChange={handleTimeChange}
              minTime={minTime ? dayjs(minTime) : undefined}
              maxTime={maxTime ? dayjs(maxTime) : undefined}
              timeSteps={{ minutes: 5 }}
            />
            <div className="d-flex justify-content-end" style={{ padding: '6px 8px', borderTop: '1px solid var(--outline)' }}>
              <Button size="small" onClick={closeAndRefocus}>
                Done
              </Button>
            </div>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </div>
  );
};

export default AppTimePicker;
