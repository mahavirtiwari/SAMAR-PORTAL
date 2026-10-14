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
  ...otherProps
}) => {
  return (
    <Tooltip
      title={title}
      arrow={arrow}
      placement={placement}
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
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{children}</span>
    </Tooltip>
  );
};

export default AppToolTip;
