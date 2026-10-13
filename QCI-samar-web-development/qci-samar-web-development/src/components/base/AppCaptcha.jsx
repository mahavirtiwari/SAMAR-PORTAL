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
const AppCaptcha = ({ value, onChange, onBlur, error, onCaptchaIdChange, reloadToken = 0, name = 'captcha' }) => {
  const [image, setImage] = useState('');
  const [loading, setLoading] = useState(false);

  const loadCaptcha = useCallback(async () => {
    setLoading(true);
    try {
      const response = await AccountService().getCaptcha();
      setImage(response?.data?.image ?? '');
      onCaptchaIdChange(response?.data?.captchaId ?? '');
    } catch (err) {
      Logger.error('Failed to load captcha', err?.message);
      setImage('');
      onCaptchaIdChange('');
    } finally {
      setLoading(false);
    }
  }, [onCaptchaIdChange]);

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha, reloadToken]);

  return (
    <div className="captchaRow">
      <div className="captchaRow__field">
        <AppInput
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Enter the characters shown"
          label="Captcha"
          isRequired
          error={error}
          maxLength={10}
          autoComplete="off"
          disableAutoCapitalize
        />
      </div>
      {image ? <img src={image} alt="Type the characters shown in this image" className="captchaImage" /> : <div className="captchaImage captchaImage--empty" aria-hidden="true" />}
      <button type="button" className="captchaRefresh" onClick={loadCaptcha} disabled={loading} aria-label="Get a new captcha image">
        ⟳
      </button>
    </div>
  );
};

export default AppCaptcha;
