import { useEffect, useRef, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import Icons from '../../../constants/Icons';
import Images from '../../../constants/Images';
import { getSiteTourPicturesAction } from '../../../redux/action/common/ApplicationAssessmentAction';
import { fetchAuthenticatedImageUrl } from '../../../utils/FileUtils';
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
  const blobUrlsRef = useRef({});
  const modalBlobRef = useRef(null);
  const [modalImageSrc, setModalImageSrc] = useState(null);
  const [modalImageLoading, setModalImageLoading] = useState(false);

  const { siteTourPictures, siteTourPicturesLoading, siteTourPicturesError } = useSelector(state => state.ApplicationAssessment);

  useEffect(() => {
    if (id) {
      dispatch(getSiteTourPicturesAction(id));
    }
  }, [dispatch, id]);

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
    const load = async () => {
      const pics = Array.isArray(siteTourPictures) ? siteTourPictures : siteTourPictures?.pictures || [];
      const promises = pics.map(async pic => {
        if (!pic?.id) {
          return null;
        }
        const src = pic.downloadUrl;
        if (!src) {
          return null;
        }
        try {
          const blobUrl = await fetchAuthenticatedImageUrl(src);
          if (blobUrl) {
            blobUrlsRef.current[pic.id] = blobUrl;
            return { id: pic.id, url: blobUrl };
          }
        } catch {
          return null;
        }
        return null;
      });

      const results = await Promise.all(promises);
      const map = {};
      results.forEach(r => {
        if (r) {
          map[r.id] = r.url;
        }
      });
      setImageUrls(map);
    };

    load();

    return () => {
      Object.values(blobUrlsRef.current).forEach(u => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      });
      blobUrlsRef.current = {};
    };
  }, [siteTourPictures]);

  // Load modal full-size image when selected
  useEffect(() => {
    const src = selectedPicture ? selectedPicture.downloadUrl : null;
    let cancelled = false;

    const loadModal = async () => {
      if (modalBlobRef.current) {
        try {
          URL.revokeObjectURL(modalBlobRef.current);
        } catch {
          // ignore
        }
        modalBlobRef.current = null;
      }

      if (!modalOpen || !src) {
        setModalImageSrc(null);
        return;
      }

      setModalImageLoading(true);
      try {
        const blobUrl = await fetchAuthenticatedImageUrl(src);
        if (!cancelled && blobUrl) {
          modalBlobRef.current = blobUrl;
          setModalImageSrc(blobUrl);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) {
          setModalImageLoading(false);
        }
      }
    };

    loadModal();

    return () => {
      cancelled = true;
      if (modalBlobRef.current) {
        try {
          URL.revokeObjectURL(modalBlobRef.current);
        } catch {
          // ignore
        }
        modalBlobRef.current = null;
      }
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
                <div className="site-card" onClick={() => handleOpenModal(picture)} style={{ cursor: 'pointer' }}>
                  <div className="site-image-wrapper">
                    <img
                      src={imageUrls[picture.id]}
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
          width: { xs: '100%', sm: '90%', md: '800px', lg: '800px' },
          maxWidth: '98vw',
          margin: { xs: 1, sm: 2, md: 3 },
        }}
      />
    </div>
  );
};

export default SiteTourTab;
