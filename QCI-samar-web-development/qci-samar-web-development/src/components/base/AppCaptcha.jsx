import { useCallback, useEffect, useState } from 'react';
import AccountService from '../../services/api/common/AccountService';
import { Logger } from '../../utils/logger';
import AppInput from './textInput/AppInput';

/**
 * Self-hosted image CAPTCHA for the public auth forms.
 *
 * The challenge id is owned by the parent form (it has to travel with the
 * submit payload); this component owns only the image and the reload.
 * A challenge is single-use server-side, so the image is refreshed whenever the
 * parent reports a failed submit via `reloadToken`.
 */
const AppCaptcha = ({ value, onChange, onBlur, error, onCaptchaIdChange, onEnabledChange, reloadToken = 0, name = 'captcha' }) => {
  const [image, setImage] = useState('');
  // The System Admin can switch the security code off (System Settings); the
  // server then says enabled=false and the field is not shown or required.
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadCaptcha = useCallback(async () => {
    setLoading(true);
    try {
      const response = await AccountService().getCaptcha();
      const isEnabled = response?.data?.enabled !== false;
      setEnabled(isEnabled);
      onEnabledChange?.(isEnabled);
      setImage(response?.data?.image ?? '');
      onCaptchaIdChange(response?.data?.captchaId ?? '');
    } catch (err) {
      Logger.error('Failed to load captcha', err?.message);
      setImage('');
      onCaptchaIdChange('');
    } finally {
      setLoading(false);
    }
  }, [onCaptchaIdChange, onEnabledChange]);

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha, reloadToken]);

  if (!enabled) {
    return null;
  }

  return (
    <div>
      {/* Label above the whole row, so the box, image and refresh button stay level. */}
      <label htmlFor={`${name}-field`} className="input-label-above">
        Security code<span className="asterics">*</span>
      </label>
      <div className="captchaRow">
        <div className="captchaRow__field">
          <AppInput
            labelAbove
            name={name}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Enter the code shown"
            error={error}
            maxLength={6}
            autoComplete="off"
            upperCase
            disableAutoCapitalize
          />
        </div>
        {image ? <img src={image} alt="Security code: type the letters and digits shown" className="captchaImage" /> : <div className="captchaImage captchaImage--empty" aria-hidden="true" />}
        <button type="button" className="captchaRefresh" onClick={loadCaptcha} disabled={loading} aria-label="Get a new security code">
          ⟳
        </button>
      </div>
    </div>
  );
};

export default AppCaptcha;
