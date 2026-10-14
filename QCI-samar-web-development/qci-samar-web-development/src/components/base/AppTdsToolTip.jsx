import { Tooltip } from '@mui/material';

const AppTdsToolTip = ({
  children,
  placement = 'bottom',
  arrow = true,
  bgcolor = 'var(--white)',
  color = 'var(--text-2)',
  fontSize = 'var(--fs-xs)',
  fontFamily = 'Inter-Medium',
  padding = '16px',
  borderRadius = '12px',
  border = '1px solid #EBEDF3',
  width = '400',
  ...otherProps
}) => {
  return (
    <Tooltip
      title={
        <div>
          <p className="fs-12 fw-400 text-2-color mb-12">
            <span className="fs-12 fw-600 heading-color">2%</span> – Generally applicable for charitable institutions, trusts, or notified entities
          </p>
          <p className="fs-12 fw-400 text-2-color bottom-seperator padding-bottom-20">
            <span className="fs-12 fw-600 heading-color">10%</span> – Generally applicable for private companies, firms, and other organizations
          </p>
          <p className="fs-12 fw-400 text-3-color mb-0">If unsure, please confirm the applicable rate with your finance or accounts team before proceeding.</p>
        </div>
      }
      arrow={arrow}
      placement={placement}
      // Touch: show on a short tap instead of a 700 ms long-press.
      enterTouchDelay={0}
      leaveTouchDelay={5000}
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
            boxShadow: '0px 0px 10px rgba(0,0,0,0.1)',
            maxWidth: !isNaN(width) ? `${width}px` : width,
            border: border,
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
      {/* Focusable so keyboard users can open the TDS guidance. */}
      <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} tabIndex={0} aria-label="TDS rate guidance">
        {children}
      </span>
    </Tooltip>
  );
};

export default AppTdsToolTip;
