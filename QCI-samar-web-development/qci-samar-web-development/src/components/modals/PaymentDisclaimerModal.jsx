import { useEffect, useState } from 'react';
import Icons from '../../constants/Icons';
import { AppButton } from '../base';
import AppCommonModal from './AppCommonModal';

const PaymentDisclaimerModal = ({ open, onClose, handleClose, onAccept }) => {
  const [applicationAcceptanceAgreement, setApplicationAcceptanceAgreement] = useState(false);
  const handleApplicationAcceptanceAgreementChange = () => {
    setApplicationAcceptanceAgreement(!applicationAcceptanceAgreement);
  };

  const handleAccept = () => {
    if (applicationAcceptanceAgreement && onAccept) {
      onAccept();
    }
    handleClose();
  };

  // Reset checkbox whenever the modal is opened so previous state doesn't persist
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        setApplicationAcceptanceAgreement(false);
      }, 300);
    }
  }, [open]);

  // Modal title
  const modalTitle = <>Undertaking</>;

  // Modal content
  const modalContent = (
    <div className="disclaimer-content">
      <div className="fs-16 fw-500 text-1-color margin-bottom-12">I/We (the applicant enterprise) undertake that:</div>

      <ol className="disclaimer-points">
        <li className="disclaimer-point margin-bottom-16">
          By agreeing to proceed and make relevant payment, I/We undertake that I/we have read and understood the requirements of the Certification for which the payment is being made and I/We take
          full responsibility for this payment.
        </li>

        <li className="disclaimer-point margin-bottom-16">
          I/we undertake that our enterprise/unit fulfills all the relevant statutory and regulatory requirements and non-fulfillment of these requirements may lead to the withdrawal of certification.
        </li>

        <li className="disclaimer-point margin-bottom-16">
          I/we understand that in case our enterprise/unit gets blacklisted by any government authority, it may also lead to the withdrawal of certification.
        </li>

        <li className="disclaimer-point margin-bottom-16">
          I/we understand that the amount once remitted is non-refundable, non-adjustable & non-transferable irrespective of the outcome of the Certification process.
        </li>

        <li className="disclaimer-point margin-bottom-24">
          I/we understand that mere submission of relevant payment does not guarantee Certification. The Certification will only be accorded after completion of due process.
        </li>
      </ol>

      <div className="agreement-section margin-bottom-24">
        <div className="custom-checkbox d-flex align-items-start" onClick={handleApplicationAcceptanceAgreementChange} style={{ cursor: 'pointer' }}>
          {applicationAcceptanceAgreement ? <img src={Icons.squareTick} alt="checkbox" className="icon-22" /> : <img src={Icons.squareUncheck} alt="checkbox" className="icon-22" />}
          <label className="form-check-label mb-0" style={{ cursor: 'pointer' }}>
            I have read and agree to the above disclaimer and terms.
          </label>
        </div>
      </div>
    </div>
  );

  // Modal footer
  const modalFooter = (
    <>
      <AppButton size="medium" variant="tertiary" onClick={handleClose} className="cancel-btn" title={'Cancel'}></AppButton>
      <AppButton size="medium" variant="primary" onClick={handleAccept} disabled={!applicationAcceptanceAgreement} className="accept-btn" title={'Confirm & Proceed'}></AppButton>
    </>
  );

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      modalFooter={modalFooter}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '700px', lg: '700px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default PaymentDisclaimerModal;
