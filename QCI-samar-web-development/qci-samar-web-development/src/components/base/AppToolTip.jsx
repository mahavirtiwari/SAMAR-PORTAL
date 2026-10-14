import { Tooltip } from '@mui/material';

const AppToolTip = ({
  title,
  children,
  placement = 'bottom',
  arrow = true,
  bgcolor = 'var(--text-1)',
  color = '#fff',
  fontSize = 'var(--fs-xs)',
  fontFamily = 'Inter-Medium',
  padding = '4px 8px',
  borderRadius = '4px',
  // Set when the wrapped content is not itself focusable (e.g. an info icon), so
  // keyboard users can reach the tooltip.
  focusable = false,
  ...otherProps
}) => {
  return (
    <Tooltip
      title={title}
      arrow={arrow}
      placement={placement}
      // Touch: show on a short tap instead of a 700 ms long-press.
      enterTouchDelay={0}
      leaveTouchDelay={3000}
      {...otherProps}
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: `${bgcolor} !important`,
            color: `${color} !important`,
            fontSize: fontSize,
            fontFamily: fontFamily,
            padding: padding,
            borderRadius: borderRadius,
          },
        },

        arrow: {
          sx: {
            color: `${bgcolor} !important`,
            '&::before': {
              backgroundColor: `${bgcolor} !important`,
              border: 'none !important',
            },
          },
        },

        popper: {
          disablePortal: false,
          sx: {
            '& .MuiTooltip-tooltip': {},
          },
        },
      }}>
      <span style={{ display: 'inline-flex', alignItems: 'center' }} {...(focusable ? { tabIndex: 0 } : {})}>
        {children}
      </span>
    </Tooltip>
  );
};

export default AppToolTip;
