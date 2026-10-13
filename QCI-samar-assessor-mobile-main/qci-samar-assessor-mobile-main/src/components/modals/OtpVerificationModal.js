import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { COLORS, FONT_SIZE, SPACING } from '../../assets/theme/Theme';
import AppButton from '../base/AppButton';

const formatCountdown = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const OtpVerificationModal = ({
  visible,
  otp,
  setOtp,
  onVerify,
  onResend,
  onClose,
  loading = false,
  resendLoading = false,
  error = null,
  length = 6,
  resendSeconds = 120
}) => {
  const inputRef = useRef(null);
  const [timeLeft, setTimeLeft] = useState(resendSeconds);

  // Reset the field and the resend cooldown each time the modal opens.
  useEffect(() => {
    if (visible) {
      setOtp('');
      setTimeLeft(resendSeconds);
    }
  }, [visible, resendSeconds, setOtp]);

  useEffect(() => {
    if (!visible || timeLeft <= 0) {
      return undefined;
    }
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [visible, timeLeft]);

  const handleResend = () => {
    setOtp('');
    setTimeLeft(resendSeconds);
    onResend();
  };

  const digits = Array.from({ length }, (_, i) => otp[i] || '');

  return (
    <Modal
      statusBarTranslucent
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}>
      <View style={styles.overlay} />
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          {onClose ? (
            <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={10}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={[commonStyles.FontFamily_SemiBold600, styles.title]}>Verify OTP</Text>
          <Text style={[commonStyles.FontFamily_Medium500, styles.subtitle]}>
            Enter the {length}-digit code sent to your registered email.
          </Text>

          <Pressable style={styles.otpRow} onPress={() => inputRef.current?.focus()}>
            {digits.map((digit, index) => (
              <View
                key={index}
                style={[
                  styles.otpBox,
                  otp.length === index && styles.otpBoxActive,
                  digit && styles.otpBoxFilled
                ]}>
                <Text style={styles.otpDigit}>{digit}</Text>
              </View>
            ))}
          </Pressable>

          <TextInput
            ref={inputRef}
            value={otp}
            onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, length))}
            keyboardType="number-pad"
            maxLength={length}
            autoFocus
            style={styles.hiddenInput}
            caretHidden
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.verifyButton}>
            <AppButton
              title="Verify"
              variant="primary"
              size="large"
              width="100%"
              loader={loading}
              disabled={loading || otp.length !== length}
              onPress={() => onVerify(otp)}
            />
          </View>

          <View style={styles.resendRow}>
            {timeLeft > 0 ? (
              <Text style={[commonStyles.FontFamily_Medium500, styles.resendTimer]}>
                Resend OTP in {formatCountdown(timeLeft)}
              </Text>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={resendLoading} hitSlop={8}>
                <Text style={[commonStyles.FontFamily_SemiBold600, styles.resendLink]}>
                  {resendLoading ? 'Resending…' : 'Resend OTP'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

OtpVerificationModal.propTypes = {
  visible: PropTypes.bool,
  otp: PropTypes.string.isRequired,
  setOtp: PropTypes.func.isRequired,
  onVerify: PropTypes.func.isRequired,
  onResend: PropTypes.func.isRequired,
  onClose: PropTypes.func,
  loading: PropTypes.bool,
  resendLoading: PropTypes.bool,
  error: PropTypes.string,
  length: PropTypes.number,
  resendSeconds: PropTypes.number
};

export default OtpVerificationModal;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.background.modalOverlay
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Responsive.width(20)
  },
  modalView: {
    backgroundColor: COLORS.background.primary,
    paddingHorizontal: Responsive.width(24),
    paddingVertical: Responsive.height(28),
    borderRadius: 20,
    width: '100%'
  },
  closeButton: {
    position: 'absolute',
    top: Responsive.height(14),
    right: Responsive.width(16),
    zIndex: 1
  },
  closeText: {
    fontSize: FONT_SIZE.fs18,
    color: COLORS.text.tertiary
  },
  title: {
    textAlign: 'center',
    color: COLORS.text.heading,
    fontSize: FONT_SIZE.fs20,
    marginBottom: Responsive.height(6)
  },
  subtitle: {
    textAlign: 'center',
    color: COLORS.text.tertiary,
    fontSize: FONT_SIZE.fs12,
    marginBottom: Responsive.height(24)
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sp8
  },
  otpBox: {
    width: Responsive.width(44),
    height: Responsive.height(52),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.text.placeholder,
    justifyContent: 'center',
    alignItems: 'center'
  },
  otpBoxActive: {
    borderColor: COLORS.primary.main
  },
  otpBoxFilled: {
    borderColor: COLORS.primary.main
  },
  otpDigit: {
    fontSize: FONT_SIZE.fs20,
    color: COLORS.text.heading,
    ...commonStyles.FontFamily_SemiBold600
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1
  },
  errorText: {
    textAlign: 'center',
    color: COLORS.button.danger,
    fontSize: FONT_SIZE.fs12,
    marginTop: Responsive.height(14),
    ...commonStyles.FontFamily_Medium500
  },
  verifyButton: {
    marginTop: Responsive.height(28)
  },
  resendRow: {
    alignItems: 'center',
    marginTop: Responsive.height(18)
  },
  resendTimer: {
    color: COLORS.text.tertiary,
    fontSize: FONT_SIZE.fs12
  },
  resendLink: {
    color: COLORS.primary.main,
    fontSize: FONT_SIZE.fs14
  }
});
