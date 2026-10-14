import { useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import Icons from '../../../constants/Icons';
import Images from '../../../constants/Images';
import useLiveRefresh from '../../../hooks/useLiveRefresh';
import { getSiteTourPicturesAction } from '../../../redux/action/common/ApplicationAssessmentAction';
import { onActivate } from '../../../utils/a11y';
import { getCachedImageUrl } from '../../../utils/FileUtils';
import { formatCoordinates, formatDateTimeOrDash, formatUploaderDesignation } from '../../../utils/formatters';
import AppCommonModal from '../../modals/AppCommonModal';
import SitePictureDetailsModal from '../../modals/SitePictureDetailsModal';

/**
 * Shared SiteTour component for Step 4 of Assessment
 * Fetches and displays site tour pictures from the API
 */
const SiteTourTab = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const [selectedPicture, setSelectedPicture] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [imageUrls, setImageUrls] = useState({});
  const [modalImageSrc, setModalImageSrc] = useState(null);
  const [modalImageLoading, setModalImageLoading] = useState(false);

  const { siteTourPictures, siteTourPicturesLoading, siteTourPicturesError } = useSelector(state => state.ApplicationAssessment);

  useEffect(() => {
    if (id) {
      dispatch(getSiteTourPicturesAction(id));
    }
  }, [dispatch, id]);

  // Pictures and captions synced from the mobile apps appear without a reload.
  useLiveRefresh(() => dispatch(getSiteTourPicturesAction({ assessmentId: id, silent: true })), { enabled: !!id });

  const handleOpenModal = picture => {
    setSelectedPicture(picture);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedPicture(null);
  };

  // Assessor captures resolve through the team member; applicant uploads
  // (service sector) have no team member, so fall back to the recorded uploader.
  const getUploaderName = picture => {
    const teamMemberName = picture.teamMember?.user?.firstName || picture.teamMember?.user?.name;
    if (teamMemberName) {
      return teamMemberName;
    }
    const applicant = picture.uploadedByUser;
    return applicant?.firstName || applicant?.fullName || applicant?.name || 'Applicant';
  };

  // Preload thumbnails (authenticated) when pictures change
  useEffect(() => {
    // The shared image cache owns these blob URLs (and revokes them on eviction), so a
    // live-refresh tick that returns the same pictures reuses what is already loaded.
    let cancelled = false;
    const pics = Array.isArray(siteTourPictures) ? siteTourPictures : siteTourPictures?.pictures || [];
    Promise.all(
      pics.map(async pic => {
        if (!pic?.id || !pic?.downloadUrl) {
          return null;
        }
        const url = await getCachedImageUrl(pic.downloadUrl, { thumb: true });
        return url ? [pic.id, url] : null;
      }),
    ).then(entries => {
      if (!cancelled) {
        setImageUrls(Object.fromEntries(entries.filter(Boolean)));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [siteTourPictures]);

  // Load modal full-size image when selected
  useEffect(() => {
    const src = selectedPicture?.downloadUrl || null;
    setModalImageSrc(null);
    if (!modalOpen || !src) {
      setModalImageLoading(false);
      return undefined;
    }
    // Full-size image for the modal, through the same cache as the thumbnails.
    let cancelled = false;
    setModalImageLoading(true);
    getCachedImageUrl(src)
      .then(blobUrl => {
        if (!cancelled && blobUrl) {
          setModalImageSrc(blobUrl);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setModalImageLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [modalOpen, selectedPicture]);

  if (siteTourPicturesLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (siteTourPicturesError) {
    return (
      <div className="alert alert-danger" role="alert">
        Failed to load site tour pictures: {siteTourPicturesError?.message || 'Unknown error'}
      </div>
    );
  }

  const allPictures = Array.isArray(siteTourPictures) ? siteTourPictures : siteTourPictures?.pictures || [];

  // Show the official (assessor-selected) set. Manufacturing assessor captures
  // are selected on upload; for service the assessor curates the applicant pool.
  // If nothing carries the flag (older data), fall back to showing everything.
  const selectedPictures = allPictures.filter(p => p.isSelected === true);
  const pictures = selectedPictures.length > 0 ? selectedPictures : allPictures;

  if (pictures.length === 0) {
    return (
      <div className="text-center py-5">
        <img src={Icons.emptyState || Images.defaultImage} alt="No pictures" className="mb-3" style={{ width: 100, opacity: 0.5 }} />
        <p className="text-muted">No site tour pictures uploaded yet</p>
      </div>
    );
  }

  // Modal content for viewing picture details (uses authenticated blob)
  const modalContent = selectedPicture && (
    <SitePictureDetailsModal
      open={modalOpen}
      onClose={handleCloseModal}
      selectedPicture={{
        ...selectedPicture,
        // Preserve teamMember.role so the modal's designation matches the card's.
        teamMember: {
          ...selectedPicture.teamMember,
          user: {
            ...selectedPicture.teamMember?.user,
            firstName: getUploaderName(selectedPicture),
          },
        },
      }}
      modalImageLoading={modalImageLoading}
      modalImageSrc={modalImageSrc}
    />
  );

  return (
    <div className="details-card">
      <div className="row g-3">
        <h3 className="card-heading mb-0">Site Tour</h3>
        {pictures.map(picture => (
          <div className="col-md-4 col-12" key={picture.id}>
            <div className="site-tour-container">
              <h3>{picture.title || 'Site Tour Photo'}</h3>
              <div className="site-tour-image-container">
                <div className="site-card" {...onActivate(() => handleOpenModal(picture))} style={{ cursor: 'pointer' }}>
                  <div className="site-image-wrapper">
                    <img
                      src={imageUrls[picture.id]}
                      loading="lazy"
                      alt={picture.title || 'Site Tour'}
                      className="site-image"
                      onError={e => {
                        e.target.src = Images.dummySite;
                      }}
                    />
                    <div className="site-overlay">
                      {formatCoordinates(picture.latitude, picture.longitude) && <div className="overlay-text">{formatCoordinates(picture.latitude, picture.longitude)}</div>}
                      <div className="overlay-text">{formatDateTimeOrDash(picture.capturedAt)}</div>
                    </div>
                  </div>
                </div>
              </div>
              <h5 className="uploader-name margin-right-10 mb-0">
                Uploaded by: <span className="text-1-color">{getUploaderName(picture)}</span>
              </h5>
              <h5 className="uploader-name margin-right-10 mb-0 mt-4">
                Designation: <span className="text-1-color">{formatUploaderDesignation(picture)}</span>
              </h5>
            </div>
          </div>
        ))}
      </div>

      <AppCommonModal
        open={modalOpen}
        onClose={handleCloseModal}
        modalHeader={selectedPicture?.title || 'Site Tour Picture'}
        modalContent={modalContent}
        paperSx={{
          width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '800px' },
          maxWidth: '98vw',
          margin: { xs: 1, sm: 2, md: 3 },
        }}
      />
    </div>
  );
};

export default SiteTourTab;
