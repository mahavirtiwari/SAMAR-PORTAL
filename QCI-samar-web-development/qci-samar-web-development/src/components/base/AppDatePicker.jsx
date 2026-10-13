import { ClickAwayListener, Paper, Popper } from '@mui/material';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import dayjs from 'dayjs';
import { useState } from 'react';
import Icons from '../../constants/Icons';
import { formatDate } from '../../utils/formatters';
import AppInput from './textInput/AppInput';

const AppDatePicker = ({ label, value, onChange, placeholder, error, name, isRequired, minDate, maxDate, subLabel, customPlacement, ...props }) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleOpen = event => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const [calendarView, setCalendarView] = useState('day');

  const handleDateChange = newDate => {
    onChange?.(newDate ? newDate.format('YYYY-MM-DD') : null);
    // Only close picker when user selects a day (not when they pick a year/month via keyboard)
    if (calendarView === 'day') {
      handleClose();
    }
  };

  const handleViewChange = newView => {
    setCalendarView(newView);
  };

  const open = Boolean(anchorEl);

  return (
    <div>
      <AppInput
        label={label}
        value={value ? formatDate(value) : ''}
        onClick={handleOpen}
        readOnly
        placeholder={placeholder}
        name={name}
        error={error}
        isRequired={isRequired}
        passwordIcon={Icons.calendar}
        subLabel={subLabel}
        autoComplete="off"
        passwordIconOnClick={handleOpen}
        inputProps={{ autoComplete: 'off' }}
        {...props}
      />

      <Popper open={open} anchorEl={anchorEl} placement={customPlacement ? customPlacement : 'bottom-start'} disablePortal sx={{ zIndex: 1300 }}>
        <ClickAwayListener onClickAway={handleClose}>
          <Paper elevation={3} sx={{ mt: 1, borderRadius: 2 }}>
            <DateCalendar
              value={value ? dayjs(value) : null}
              onChange={handleDateChange}
              onViewChange={handleViewChange}
              minDate={minDate ? dayjs(minDate) : undefined}
              maxDate={maxDate ? dayjs(maxDate) : undefined}
              shouldDisableDate={date => (maxDate ? date.isAfter(dayjs(maxDate), 'day') : false)}
            />
          </Paper>
        </ClickAwayListener>
      </Popper>
    </div>
  );
};

export default AppDatePicker;
