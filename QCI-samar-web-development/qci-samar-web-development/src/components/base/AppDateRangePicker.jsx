import { ClickAwayListener, Paper, Popper } from '@mui/material';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickerDay } from '@mui/x-date-pickers/PickerDay';
import dayjs from 'dayjs';
import { useState } from 'react';
import Icons from '../../constants/Icons';
import { formatDate } from '../../utils/formatters';
import AppButton from './AppButton';
import AppInput from './textInput/AppInput';

const RangeDay = ({ day, selectedStart, selectedEnd, ...pickersDayProps }) => {
  const start = selectedStart ? dayjs(selectedStart) : null;
  const end = selectedEnd ? dayjs(selectedEnd) : null;

  const isStart = start && day.isSame(start, 'day');
  const isEnd = end && day.isSame(end, 'day');
  const inRange = start && end && day.isAfter(start, 'day') && day.isBefore(end, 'day');

  return (
    <PickerDay
      {...pickersDayProps}
      day={day}
      selected={!!(isStart || isEnd)}
      sx={
        inRange
          ? {
              backgroundColor: 'var(--primary-20)',
              '&:hover, &:focus': { backgroundColor: 'var(--primary-20)' },
            }
          : undefined
      }
    />
  );
};

const AppDateRangePicker = ({ label, value, onChange, placeholder, error, name, isRequired, minDate, maxDate, subLabel, customPlacement, ...props }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [calendarView, setCalendarView] = useState('day');
  const [awaitingEnd, setAwaitingEnd] = useState(false);

  const startDate = value?.startDate || null;
  const endDate = value?.endDate || null;

  const handleOpen = event => {
    setAwaitingEnd(false);
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAwaitingEnd(false);
    setAnchorEl(null);
  };

  const handleDateChange = newDate => {
    if (calendarView !== 'day') {
      return;
    }
    const picked = newDate.format('YYYY-MM-DD');

    // First pick of a selection defaults the range to that single day (start = end),
    // then keeps the calendar open so the end can be extended.
    if (!awaitingEnd || picked < startDate) {
      onChange?.({ startDate: picked, endDate: picked });
      setAwaitingEnd(true);
      return;
    }

    onChange?.({ startDate, endDate: picked });
    setAwaitingEnd(false);
    handleClose();
  };

  const open = Boolean(anchorEl);
  const displayValue = startDate ? `${formatDate(startDate)}${endDate ? ` - ${formatDate(endDate)}` : ''}` : '';
  const calendarValue = endDate || startDate;

  return (
    <div>
      <AppInput
        label={label}
        value={displayValue}
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
              value={calendarValue ? dayjs(calendarValue) : null}
              onChange={handleDateChange}
              onViewChange={setCalendarView}
              minDate={minDate ? dayjs(minDate) : undefined}
              maxDate={maxDate ? dayjs(maxDate) : undefined}
              shouldDisableDate={date => (maxDate ? date.isAfter(dayjs(maxDate), 'day') : false)}
              slots={{ day: RangeDay }}
              slotProps={{ day: { selectedStart: startDate, selectedEnd: endDate } }}
            />
            {awaitingEnd ? (
              <div className="d-flex align-items-center justify-content-between gap-8" style={{ padding: '0 16px 16px' }}>
                <span className="fs-12 fw-400 text-3-color">Pick another date to extend the range</span>
                <AppButton title="Done" type="button" size="extraSmall" onClick={handleClose} />
              </div>
            ) : null}
          </Paper>
        </ClickAwayListener>
      </Popper>
    </div>
  );
};

export default AppDateRangePicker;
