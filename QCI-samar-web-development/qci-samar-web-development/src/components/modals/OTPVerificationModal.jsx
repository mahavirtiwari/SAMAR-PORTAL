import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import { OTPInput } from 'input-otp';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { AppButton } from '../base';

const OTPVerificationModal = ({ show, handleClose, length = 6, resendSeconds = 120, onVerify, onResend, otp, setOtp, data, loading }) => {
  const [timeLeft, setTimeLeft] = useState(resendSeconds);

  // Reset timer and OTP when modal opens
  useEffect(() => {
    setTimeout(() => {
      if (show) {
        setTimeLeft(resendSeconds);
        setOtp('');
      }
    }, 100);
  }, [show, resendSeconds, setOtp]);

  // Countdown Timer
  useEffect(() => {
    if (!show || timeLeft === 0) {
      return;
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [show, timeLeft]);

  const handleChange = value => {
    // Only allow numbers
    const sanitized = String(value).replace(/[^0-9]/g, '');
    setOtp(sanitized);
  };

  const handleVerify = async () => {
    if (otp.length === length) {
      await onVerify(otp);
    }
  };

  const handleResend = async () => {
    setTimeLeft(resendSeconds);
    setOtp('');
    await onResend();
  };

  const handlePaste = e => {
    e.preventDefault();
  };

  return (
    <Dialog
      open={show}
      onClose={(event, reason) => {
        if (reason && reason === 'backdropClick') {
          return;
        }
        handleClose();
      }}
      fullWidth
      maxWidth="xs"
      className="otp-modal"
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: '90%', md: '800px', lg: '500px' },
          maxWidth: '98vw',
          margin: { xs: 1, sm: 2, md: 3 },
        },
      }}>
      <DialogContent>
        <h4 className="fs-24 fw-600 heading-color mb-0 text-center">OTP Verification</h4>
        <p className="fs-14 fw-500 mb-0 text-2-color margin-top-8 text-center">Enter the verification code sent to your registered email address.</p>
        <p className="fs-12 fw-500 mb-0 text-3-color margin-top-6 text-center">If you have not received the OTP, please check your spam folder.</p>
        <div className="margin-top-30" onPaste={handlePaste}>
          <OTPInput
            maxLength={length}
            value={otp}
            onChange={handleChange}
            disabled={loading}
            containerClassName="otp-container"
            render={({ slots }) => (
              <>
                {slots.map((slot, idx) => (
                  <div
                    key={idx}
                    className={`otp-each-box transition ${slot.isActive ? 'active' : 'inactive'} ${loading ? 'disabled' : ''}`}
                    onClick={slot.onClick}
                    style={{ position: 'relative', opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}>
                    {slot.char}
                    {slot.isActive && !slot.char && (
                      <span
                        className="otp-cursor"
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          height: '1.5em',
                          width: '2px',
                          background: '#000',
                          animation: 'otp-blink 1s steps(2, start) infinite',
                          borderRadius: '1px',
                          display: 'inline-block',
                        }}
                      />
                    )}
                  </div>
                ))}
              </>
            )}
          />
          {/* Timer + Resend */}
          <p className="fs-12 fw-500 text-center text-2-color margin-top-24 mb-0">
            {timeLeft > 0 ? (
              <>
                Didn’t receive a code? ({timeLeft}s)
                <AppButton size="small" variant="link" disabled={timeLeft !== 0} onClick={handleResend} title={'Resend'} />
              </>
            ) : (
              <>
                Didn’t receive a code?
                <AppButton size="small" variant="link" disabled={timeLeft !== 0} onClick={handleResend} title={'Resend'} />
              </>
            )}
          </p>
        </div>
      </DialogContent>
      <DialogActions>
        <AppButton customClass="w-100" onClick={handleVerify} title="Verify" size="medium" disabled={otp.length !== length || loading} loading={loading} />
      </DialogActions>
    </Dialog>
  );
};

OTPVerificationModal.propTypes = {
  show: PropTypes.bool.isRequired,
  handleClose: PropTypes.func.isRequired,
  length: PropTypes.number,
  resendSeconds: PropTypes.number,
  onVerify: PropTypes.func.isRequired,
  onResend: PropTypes.func.isRequired,
  otp: PropTypes.string.isRequired,
  setOtp: PropTypes.func.isRequired,
};

export default OTPVerificationModal;
