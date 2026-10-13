import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import Icons from '../../constants/Icons';
import { formatTime } from '../../utils/formatters';
import AppInput from './textInput/AppInput';

const AppTimePicker = ({ label, value, onChange, placeholder, error, name, isRequired, minTime, maxTime, subLabel, ...props }) => {
  const idRef = useRef(null);
  const [open, setOpen] = useState(false);

  // keep ref for potential future uniqueness, no impure calls during render
  useEffect(() => {
    if (!idRef.current) {
      idRef.current = `apptimepicker-${Date.now()}`;
    }
  }, []);

  const handleTimeChange = newTime => {
    // Emit time in 24-hour `HH:mm` format (string) so form values match validation schemas
    try {
      onChange?.(newTime && newTime.isValid ? dayjs(newTime).format('HH:mm') : '');
    } catch (_e) {
      onChange?.(newTime ? newTime.toDate() : null);
    }
  };

  // helper: accept various value shapes and return a dayjs instance or null
  const parseToDayjs = v => {
    if (!v && v !== 0) {
      return null;
    }
    if (dayjs.isDayjs(v)) {
      return v;
    }
    if (typeof v === 'string') {
      // try common formats (HH:mm, HH:mm:ss, ISO)
      const d = dayjs(v, ['HH:mm', 'HH:mm:ss', dayjs.ISO_8601]);
      if (d.isValid()) {
        return d;
      }
      // fallback: if string like '14:30' but parsing failed, construct from parts
      const m = v.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (m) {
        const now = dayjs();
        return now
          .hour(parseInt(m[1], 10))
          .minute(parseInt(m[2], 10))
          .second(m[3] ? parseInt(m[3], 10) : 0);
      }
      const iso = dayjs(v);
      return iso.isValid() ? iso : null;
    }
    if (v instanceof Date) {
      return dayjs(v);
    }
    return null;
  };

  const parsedValue = parseToDayjs(value);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <div className="timePicker-container">
        <TimePicker
          enableAccessibleFieldDOMStructure={false}
          open={open}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          value={parsedValue || dayjs()}
          onChange={handleTimeChange}
          viewRenderers={{
            hours: renderTimeViewClock,
            minutes: renderTimeViewClock,
            seconds: renderTimeViewClock,
          }}
          minTime={minTime ? dayjs(minTime) : undefined}
          maxTime={maxTime ? dayjs(maxTime) : undefined}
          className={`input-container ${(props && props.className) || ''}`}
          slotProps={{
            layout: {
              sx: {
                '& .MuiClock-clock': {
                  backgroundColor: 'rgb(246, 246, 246)',
                },
                '& .MuiClockPointer-thumb': {
                  border: '16px solid #3e8bfd',
                  backgroundColor: '#3e8bfd',
                },
                '& .MuiButton-root': {
                  color: '#3e8bfd',
                },
              },
            },
          }}
          slots={{
            textField: params => (
              <AppInput
                {...params}
                label={label}
                placeholder={placeholder}
                name={name}
                // display in 12-hour format with AM/PM for readability, or empty if no value
                value={value ? formatTime(value) : ''}
                readOnly={true}
                error={error || params.error}
                isRequired={isRequired}
                passwordIcon={Icons.calendar}
                passwordIconOnClick={() => setOpen(true)}
                subLabel={subLabel}
                className={(props && props.className) || ''}
                inputProps={{ ...(params.inputProps || {}), autoComplete: 'off', style: { cursor: 'pointer' }, onClick: () => setOpen(true) }}
                onClick={() => setOpen(true)}
                {...props}
              />
            ),
          }}
        />
      </div>
    </LocalizationProvider>
  );
};

export default AppTimePicker;
