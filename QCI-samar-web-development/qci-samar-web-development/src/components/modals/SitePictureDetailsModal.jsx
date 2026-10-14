// import CloseIcon from '@mui/icons-material/Close';

import PropTypes from 'prop-types';
import { Spinner } from 'react-bootstrap';
import DefaultIcons from '../../constants/Icons';
import { onActivate } from '../../utils/a11y';
import { formatPersonName, formatUploaderDesignation } from '../../utils/formatters';
import ViewLocation from '../../utils/ViewLocation';
import AppCommonModal from './AppCommonModal';

/**
 * SitePictureDetailsModal - Dynamic modal content for site picture details
 * Receives all data and handlers as props from parent
 */

const SitePictureDetailsModal = ({ open, onClose, selectedPicture, modalImageLoading, modalImageSrc, Icons }) => {
  if (!selectedPicture) {
    return null;
  }

  const icons = Icons || DefaultIcons;

  // Site tour pictures carry the assessor's comment as `title`; question evidences carry it as `description`.
  const pictureComment = selectedPicture.title || selectedPicture.description;

  // Assessor captures resolve through the team member; applicant uploads have no
  // team member, so fall back to the recorded uploader.
  const uploaderName = formatPersonName(selectedPicture.teamMember?.user) || formatPersonName(selectedPicture.uploadedByUser);

  const modalContent = (
    <div className="col-12">
      <div className="site-card">
        <div className="modal-site-image-wrapper">
          {modalImageLoading ? (
            <div className="d-flex justify-content-center align-items-center modal-site-image" style={{ minHeight: 300 }}>
              <Spinner animation="border" variant="primary" />
            </div>
          ) : (
            <img src={modalImageSrc} alt={selectedPicture.title || 'Site Picture'} className="modal-site-image" />
          )}
          {/* <div className="site-overlay">
            {(selectedPicture.latitude, selectedPicture.longitude) ? (
              <div className="overlay-text">
                {selectedPicture.latitude}, {selectedPicture.longitude}
              </div>
            ) : null}
            <div className="overlay-text">{formatDateTime(selectedPicture.capturedAt)}</div>
          </div> */}
        </div>
      </div>
    </div>
  );
  const modalFooter = (
    <div className="d-flex justify-content-between align-items-start" style={{ width: '100%' }}>
      {selectedPicture.latitude && selectedPicture.longitude ? (
        <div className="d-flex justify-content-start align-items-center" style={{ cursor: 'pointer' }} {...onActivate(() => ViewLocation(selectedPicture.latitude, selectedPicture.longitude))}>
          <span className="fs-14 fw-500 mb-0 primary-color margin-right-2 mt-0">View Location</span>
          <img src={icons.sendArrow} alt="location" className="icon-16" />
        </div>
      ) : null}
      {uploaderName ? (
        <div className="text-end">
          <span className="fs-12 text-muted">Uploaded by: </span>
          <span className="fs-14 fw-500">{uploaderName}</span>

          <h5 className="fs-12 text-muted">
            Designation: <span className="fs-14 fw-500">{formatUploaderDesignation(selectedPicture)}</span>
          </h5>
        </div>
      ) : null}
    </div>
  );

  return (
    <AppCommonModal
      open={open}
      onClose={onClose}
      modalHeader={
        <span className="text-truncate" title={pictureComment || undefined} style={{ minWidth: 0 }}>
          {pictureComment || 'Site Picture'}
        </span>
      }
      modalFooter={modalFooter}
      modalContent={modalContent}
      paperSx={{
        width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '800px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

SitePictureDetailsModal.propTypes = {
  selectedPicture: PropTypes.object,
  modalImageLoading: PropTypes.bool,
  modalImageSrc: PropTypes.string,
  Icons: PropTypes.object,
};

export default SitePictureDetailsModal;
