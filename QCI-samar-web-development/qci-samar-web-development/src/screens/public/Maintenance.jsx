import { Container } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import AppSettings from '../../appsettings';
import { AppButton } from '../../components/base';
import Images from '../../constants/Images';
import useContentBlocks from '../../hooks/useContentBlocks';
import { logoutUserAction } from '../../redux/action/common/AccountAction';
import { Logger } from '../../utils/logger';

const Maintenance = () => {
  const navigate = useNavigate();
  // Message is editable in Settings → Content & Disclaimers.
  const blocks = useContentBlocks(['maintenance_message']);
  const dispatch = useDispatch();
  const { isUserLoggedIn } = useSelector(state => state.Account);

  const handleBackToLogin = async () => {
    try {
      await dispatch(logoutUserAction());
      navigate('/');
    } catch (error) {
      Logger.error('Logout from maintenance screen failed:', error);
    }
  };

  return (
    <section className="maintenance">
      <Container fluid className="d-flex flex-column align-items-center justify-content-center min-vh-100">
        <div className="text-center">
          <img src={Images.samarLogo} alt="SAMAR Logo" className="samarLogo mb-4" />
          <div className="maintenance-icon mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#3278B9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <h1 className="fs-32 fw-700 primary-color mb-3">System Under Maintenance</h1>
          <p className="fs-18 fw-500 text-1-color mb-4" style={{ maxWidth: '600px' }}>
            {blocks.maintenance_message?.body || 'We are currently performing scheduled maintenance to improve our services. The system will be back online shortly.'}
          </p>
          <p className="fs-16 fw-400 text-2-color mb-4">We apologize for any inconvenience. Please try again later.</p>
          {isUserLoggedIn ? (
            <div className="mb-4">
              <AppButton title="Return to Login" size="medium" onClick={handleBackToLogin} />
            </div>
          ) : null}
          <p className="fs-12 fw-500 text-3-color mt-5">Build Version - {AppSettings.VERSION}</p>
        </div>
      </Container>
    </section>
  );
};

export default Maintenance;
