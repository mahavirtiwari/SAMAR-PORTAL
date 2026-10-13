import Icons from '../../constants/Icons';
import AppModal from './AppModal';

const IdleTimeoutWarning = ({ show, remainingSeconds, onStayLoggedIn, onLogout, logoutLoading }) => {
  return (
    <AppModal
      modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
      image={Icons.logoutCircle}
      show={show}
      disableBackdropClick
      header="Session Expiring"
      subHeader={`Your session is about to expire due to inactivity. You will be logged out in ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}.`}
      twoButtons={true}
      leftButton="Stay Logged In"
      leftButtonClassName="w-100 tertiary"
      leftButtonOnClick={onStayLoggedIn}
      rightButton="Logout"
      rightButtonClassName="w-100 danger-primary"
      rightButtonOnClick={onLogout}
      rightButtonLoading={logoutLoading}
    />
  );
};

export default IdleTimeoutWarning;
