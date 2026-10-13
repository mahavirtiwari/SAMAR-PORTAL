import { useState } from 'react';
import { useDispatch } from 'react-redux';
import Icons from '../../constants/Icons';
import { getClosingMeetingAction, getOpeningMeetingAction, updateMeetingCommentsAction } from '../../redux/action/common/ApplicationAssessmentAction';
import { Logger } from '../../utils/logger';
import AppModal from '../modals/AppModal';
import EditCommentModal from '../modals/EditCommentModal';
import AppAvatar from './AppAvatar';

const getInitials = name => {
  if (!name) {
    return '';
  }
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2);
};

const AppCommentCard = ({ comment, onEdit, assessmentId, type, editComment }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  const dispatch = useDispatch();
  const handleEditClick = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleSaveComment = async newComment => {
    if (!assessmentId) {
      return;
    }

    try {
      await dispatch(updateMeetingCommentsAction({ assessmentId, type, data: { comment: newComment } })).unwrap();
    } catch (error) {
      Logger.error('Failed to update meeting comment:', error);
      return;
    }

    handleCloseModal();
    if (type === 'opening') {
      dispatch(getOpeningMeetingAction(assessmentId));
    } else {
      dispatch(getClosingMeetingAction(assessmentId));
    }

    setSuccessModal(true);
    setTimeout(() => {
      setSuccessModal(false);
    }, 3000);
  };
  return (
    <div className="d-flex">
      <div>
        <AppAvatar size={'36'} alt={comment.name} role={comment.role}>
          {getInitials(comment.name)}
        </AppAvatar>
      </div>

      <div className="margin-left-12 w-100">
        <div className="d-flex justify-content-between w-100 align-items-start">
          <div className="lh-normal-16">
            <h3 className="fs-16 fw-500 text-1-color mb-0">{comment.name}</h3>
            <span className="fs-12 fw-400 text-3-color">{comment.role}</span>
          </div>
          <div className="d-flex align-items-center">
            <h4 className="fs-12 fw-500 text-4-color mb-0">{comment.timestamp}</h4>
            {onEdit && editComment && <img src={Icons.edit} alt="edit" className="cursor-pointer icon-16 margin-left-4" onClick={handleEditClick} />}
          </div>
        </div>
        <p className="fs-14 fw-400 text-2-color mb-0 margin-top-8 lh-normal">{comment.message}</p>
      </div>
      <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} image={Icons.successCircle} show={successModal} header={'Comment updated successfully'} />

      <EditCommentModal show={modalOpen} handleClose={handleCloseModal} data={comment} onSave={handleSaveComment} />
    </div>
  );
};

export default AppCommentCard;
