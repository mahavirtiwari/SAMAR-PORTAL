import { useEffect, useRef, useState } from 'react';
import { COMMENT_MAX_LENGTH } from '../../constants/appConstants';
import { formatDate } from '../../utils/formatters';
import AppAvatar from '../base/AppAvatar';
import AppButton from '../base/AppButton';
import AppInput from '../base/textInput/AppInput';
import AppCommonModal from './AppCommonModal';

const EditCommentModal = ({ show, handleClose, onSave, disabled, loading, data, comment }) => {
  const [commentText, setCommentText] = useState(comment ?? data?.assessorRemarks ?? data?.message ?? '');
  const [error, setError] = useState('');
  const wasShown = useRef(false);
  useEffect(() => {
    if (show && !wasShown.current) {
      setCommentText(comment ?? data?.assessorRemarks ?? data?.message ?? '');
      setError('');
    }
    wasShown.current = show;
  }, [show, data, comment]);

  const modalTitle = <>Edit Comment</>;

  const authorName = data?.assessor?.name || data?.name || 'Unknown';
  const authorRole = data?.assessor?.role || data?.role || 'Assessor';
  const displayDate = data?.assessedAt || data?.timestamp;

  const handleSaveClick = () => {
    const trimmed = commentText.trim();
    if (!trimmed) {
      setError('Comment is required');
      return;
    }
    if (typeof onSave === 'function') {
      onSave(trimmed);
    }
  };

  const handleChange = e => {
    setCommentText(e.target.value);
    if (error) {
      setError('');
    }
  };

  const modalContent = (
    <>
      <div className="parameter-top-card">
        <div className="row">
          <div className="col-12">
            <div className="d-flex align-items-center">
              <AppAvatar alt={authorName} size="36" />
              <div className="d-flex flex-column margin-left-12 flex-grow-1">
                <span className="fs-14 fw-600 heading-color">{authorName}</span>
                <span className="fs-12 fw-500 text-3-color">{authorRole}</span>
              </div>
              <span className="fs-12 fw-500 text-3-color">{formatDate(displayDate)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="divider"></div>
      <AppInput label={'Comment'} multiline rows={4} maxLength={COMMENT_MAX_LENGTH} value={commentText} onChange={handleChange} placeholder={'Enter comment'} isRequired error={error} />
      <div className="d-flex justify-content-end margin-top-4">
        <span className="fs-12 fw-500 text-3-color">
          {(commentText || '').length}/{COMMENT_MAX_LENGTH}
        </span>
      </div>
    </>
  );

  const modalFooter = <AppButton variant="primary" size="medium" title="Update Comment" onClick={handleSaveClick} disabled={disabled} loading={loading} />;

  return (
    <AppCommonModal
      open={show}
      onClose={handleClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      modalFooter={modalFooter}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '800px', lg: '700px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
        borderRadius: 3,
        p: 1,
      }}
    />
  );
};

export default EditCommentModal;
