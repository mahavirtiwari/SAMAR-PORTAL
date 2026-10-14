// import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import useContentBlocks from '../../hooks/useContentBlocks';
import AppButton from '../base/AppButton';
import ContentBlock from '../base/ContentBlock';
import AppCommonModal from './AppCommonModal';

const InstructionModal = ({ open, handleClose, handleCloseManualModal, onClose }) => {
  const navigate = useNavigate();
  const blocks = useContentBlocks(['registration_instructions']);
  // Modal content
  const modalTitle = <>Instructions</>;
  const modalContent = (
    <>
      {/* Editable in Settings → Content & Disclaimers; the text below is the fallback. */}
      <ContentBlock block={blocks.registration_instructions} className="fs-14 fw-400 text-3-color content-block">
        <p className="fs-14 fw-400 text-3-color mb-0">By creating an account on the SAMAR portal, you acknowledge and agree to the following:</p>
        <ol className="fs-14 fw-400 text-3-color mb-0">
          <li>The information provided during registration must be accurate, complete, and up to date.</li>
          <li>You are responsible for maintaining the confidentiality of your login credentials and for all activities performed under your account.</li>
          <li>The SAMAR portal and its administrators are not liable for any loss, misuse, or unauthorised access to your account.</li>
          <li>All submitted applications, documents, and data will be used solely for the purpose of processing assessments, certifications, and related activities within the SAMAR system.</li>
          <li>By using this portal, you consent to the collection, storage, and processing of your data in accordance with applicable laws and the portal’s privacy policies.</li>
        </ol>
      </ContentBlock>
      <div className="margin-top-50 margin-bottom-20">
        <AppButton
          title="Proceed"
          size="medium"
          onClick={() => {
            navigate('/register'), handleCloseManualModal;
          }}
          customClass={'w-100'}
        />
      </div>
    </>
  );

  // Modal footer
  // const modalFooter = ;

  return (
    <AppCommonModal
      open={open}
      onClose={handleCloseManualModal}
      modalHeader={modalTitle}
      modalContent={modalContent}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '800px', lg: '500px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default InstructionModal;
