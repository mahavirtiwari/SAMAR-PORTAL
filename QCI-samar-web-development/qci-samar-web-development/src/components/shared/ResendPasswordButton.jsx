import PropTypes from 'prop-types';
import { useState } from 'react';
import { Image } from 'react-bootstrap';
import Icons from '../../constants/Icons';
import Api from '../../services/api';
import { AppToolTip } from '../base';
import { toastError, toastSuccess } from '../base/toast';
import { AppModal } from '../modals';

/**
 * Row action on the user lists: after a confirmation, emails the user a new
 * temporary password (the old one stops working and they are signed out).
 */
const ResendPasswordButton = ({ user }) => {
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const name = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'this user';

  const send = async () => {
    setSending(true);
    try {
      const result = await Api.UnitAdmin.resendUserCredentials(user.id);
      toastSuccess(result?.message || 'A new password has been emailed.');
      setConfirming(false);
    } catch (error) {
      const data = error?.response?.data;
      toastError(data?.message || 'The password could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <AppToolTip title="Resend password">
        <Image src={Icons.resendPasswordAction} className="icon-28" style={{ cursor: 'pointer' }} alt="Resend password" onClick={() => setConfirming(true)} />
      </AppToolTip>
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--info-light, #e0f2fe)' }}
        image={Icons.successCircle}
        show={confirming}
        header="Resend password?"
        subHeader={`A new temporary password will be emailed to ${name}${user?.email ? ` (${user.email})` : ''}. Their current password will stop working and they will be signed out.`}
        twoButtons
        leftButton="Cancel"
        leftButtonClassName="w-100 tertiary"
        leftButtonOnClick={() => setConfirming(false)}
        rightButton={sending ? 'Sending' : 'Send password'}
        rightButtonClassName="w-100 primary"
        rightButtonOnClick={send}
        rightButtonLoading={sending}
        rightButtonDisabled={sending}
      />
    </>
  );
};

ResendPasswordButton.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    fullName: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
  }).isRequired,
};

export default ResendPasswordButton;
