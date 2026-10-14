import { useEffect, useRef, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import Icons from '../../../constants/Icons';
import Images from '../../../constants/Images';
import useLiveRefresh from '../../../hooks/useLiveRefresh';
import { getSitePicturesAction } from '../../../redux/action/common/ApplicationAssessmentAction';
import { isServiceSector } from '../../../utils/assessmentExecution';
import { fetchAuthenticatedImageUrl } from '../../../utils/FileUtils';
import { formatCoordinates, formatDateTimeOrDash, formatPersonName, formatUploaderDesignation } from '../../../utils/formatters';
import SitePictureDetailsModal from '../../modals/SitePictureDetailsModal';

/**
 * Shared SitePictures component for Step 2 of Assessment
 * Fetches and displays site pictures from the API
 */
const SitePictures = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const [selectedPicture, setSelectedPicture] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { sitePictures, sitePicturesLoading, sitePicturesError } = useSelector(state => state.ApplicationAssessment);
  const { assessment } = useSelector(state => state.Assessment);
  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;
  const _isServiceSectorAssessment = isServiceSector(assessmentData);

  useEffect(() => {
    if (!id) {
      return undefined;
    }
    dispatch(getSitePicturesAction(id));
    return undefined;
  }, [dispatch, id]);

  // Pictures synced from the mobile apps while this step is open appear without a reload.
  useLiveRefresh(() => dispatch(getSitePicturesAction({ assessmentId: id, silent: true })), { enabled: !!id });

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
    const teamMemberName = formatPersonName(picture?.teamMember?.user);
    if (teamMemberName) {
      return teamMemberName;
    }
    return formatPersonName(picture?.uploadedByUser) || 'Applicant';
  };

  // Modal image state for authenticated fetch (blob URL)
  const [modalImageSrc, setModalImageSrc] = useState(null);
  const [modalImageLoading, setModalImageLoading] = useState(false);
  const [imageUrls, setImageUrls] = useState({});
  const blobUrlsRef = useRef({});
  const modalBlobRef = useRef(null);

  // Load image URLs for all pictures
  useEffect(() => {
    const loadImageUrls = async () => {
      const pictures = Array.isArray(sitePictures) ? sitePictures : sitePictures?.sitePictures || sitePictures?.pictures || sitePictures?.data?.sitePictures || [];

      const urlPromises = pictures.map(async picture => {
        if (!picture?.id || !picture?.downloadUrl) {
          return null;
        }

        try {
          const blobUrl = await fetchAuthenticatedImageUrl(picture.downloadUrl);
          if (blobUrl) {
            blobUrlsRef.current[picture.id] = blobUrl;
            return { id: picture.id, url: blobUrl };
          }
        } catch {
          return null;
        }
      });

      const urls = await Promise.all(urlPromises);
      const urlMap = {};
      urls.forEach(item => {
        if (item) {
          urlMap[item.id] = item.url;
        }
      });
      setImageUrls(urlMap);
    };

    if (sitePictures) {
      loadImageUrls();
    }

    return () => {
      Object.values(blobUrlsRef.current).forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
      blobUrlsRef.current = {};
    };
  }, [sitePictures]);

  // Load full image for modal when a picture is selected
  useEffect(() => {
    const src = selectedPicture ? selectedPicture.downloadUrl || null : null;
    let cancelled = false;

    const loadModalImage = async () => {
      // revoke previous modal blob
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
        // ignore - fall back to dummy image
      } finally {
        if (!cancelled) {
          setModalImageLoading(false);
        }
      }
    };

    loadModalImage();

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

  // Get image URL from state (no async, no ref access during render)
  const getImageUrl = picture => {
    if (!picture?.id) {
      return Images.dummySite;
    }
    return imageUrls[picture.id];
  };

  if (sitePicturesLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (sitePicturesError) {
    return (
      <div className="alert alert-danger" role="alert">
        Failed to load site pictures: {sitePicturesError?.message || 'Unknown error'}
      </div>
    );
  }

  // Group pictures by type (interior/exterior) based on title or show all
  // Normalize different possible shapes returned by the API
  // API responses may be: [] OR { sitePictures: [...] } OR { pictures: [...] } OR { data: { sitePictures: [...] } }
  const allPictures = Array.isArray(sitePictures) ? sitePictures : sitePictures?.sitePictures || sitePictures?.pictures || sitePictures?.data?.sitePictures || [];

  // Show the official (assessor-selected) set. Manufacturing assessor captures
  // are selected on upload; for service the assessor curates the applicant pool.
  // If nothing carries the flag (older data), fall back to showing everything.
  const selectedPictures = allPictures.filter(p => p.isSelected === true);
  const pictures = selectedPictures.length > 0 ? selectedPictures : allPictures;

  // Find interior and exterior pictures (or just use first two if no specific naming)
  const interiorPictures = pictures.filter(p => p.title?.toLowerCase().includes('interior') || p.title?.toLowerCase().includes('inside'));
  const exteriorPictures = pictures.filter(p => p.title?.toLowerCase().includes('exterior') || p.title?.toLowerCase().includes('outside') || p.title?.toLowerCase().includes('entrance'));

  // If no categorized pictures, show all pictures in a grid
  const hasCategories = interiorPictures.length > 0 || exteriorPictures.length > 0;

  if (pictures.length === 0) {
    return (
      <div className="text-center py-5">
        <img src={Icons.emptyState || Images.defaultImage} alt="No pictures" className="mb-3" style={{ width: 100, opacity: 0.5 }} />
        <p className="text-muted">No site pictures uploaded yet</p>
      </div>
    );
  }

  // If we have categorized pictures, show in two columns
  if (hasCategories) {
    return (
      <>
        {/* {isServiceSectorAssessment && <p className="fs-14 fw-500 text-3-color mb-3">Uploaded by applicant.</p>} */}
        <div className="row">
          <div className="col-12 col-md-6 right-border">
            <div className="site-container">
              <h3 className="fs-16 fw-600 heading-color margin-bottom-16">Site Interior Pictures</h3>
              {interiorPictures.length > 0 ? (
                interiorPictures?.map(picture => (
                  <div key={picture.id} className="site-card mb-3" onClick={() => handleOpenModal(picture)} style={{ cursor: 'pointer' }}>
                    <div className="site-image-wrapper">
                      <img
                        src={picture && getImageUrl(picture)}
                        alt={picture.title || 'Site Interior'}
                        className="site-image"
                        // onError={e => {
                        //   e.target.src = Images.dummySite;
                        // }}
                      />
                      <div className="site-overlay">
                        {formatCoordinates(picture.latitude, picture.longitude) && <div className="overlay-text">{formatCoordinates(picture.latitude, picture.longitude)}</div>}
                        <div className="overlay-text">{formatDateTimeOrDash(picture.capturedAt)}</div>
                      </div>
                    </div>
                    <h5 className="uploader-name margin-right-10 mb-0 mt-2">
                      Uploaded by: <span className="text-1-color">{getUploaderName(picture)}</span>
                    </h5>
                    <h5 className="uploader-name margin-right-10 mb-0">
                      Designation: <span className="text-1-color">{formatUploaderDesignation(picture)}</span>
                    </h5>
                  </div>
                ))
              ) : (
                <p className="text-muted">No interior pictures uploaded</p>
              )}
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="site-container">
              <h3 className="fs-16 fw-600 heading-color margin-bottom-16">Site Exterior Pictures</h3>
              {exteriorPictures.length > 0 ? (
                exteriorPictures.map(picture => (
                  <div key={picture.id} className="site-card mb-3" onClick={() => handleOpenModal(picture)} style={{ cursor: 'pointer' }}>
                    <div className="site-image-wrapper">
                      <img
                        src={picture && getImageUrl(picture)}
                        alt={picture.title || 'Site Exterior'}
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
                    <h5 className="uploader-name margin-right-10 mb-0 mt-2">
                      Uploaded by: <span className="text-1-color">{getUploaderName(picture)}</span>
                    </h5>
                    <h5 className="uploader-name margin-right-10 mb-0">
                      Designation: <span className="text-1-color">{formatUploaderDesignation(picture)}</span>
                    </h5>
                  </div>
                ))
              ) : (
                <p className="text-muted">No exterior pictures uploaded</p>
              )}
            </div>
          </div>
        </div>

        <SitePictureDetailsModal
          open={modalOpen}
          onClose={handleCloseModal}
          selectedPicture={
            selectedPicture
              ? {
                  ...selectedPicture,
                  teamMember: {
                    ...selectedPicture.teamMember,
                    user: { ...selectedPicture.teamMember?.user, firstName: getUploaderName(selectedPicture) },
                  },
                }
              : null
          }
          modalImageLoading={modalImageLoading}
          modalImageSrc={modalImageSrc}
        />
      </>
    );
  }

  // No interior/exterior titles — show every uploaded picture in a grid so the
  // step is never blank (applicant uploads may not carry category titles).
  return (
    <>
      {/* {isServiceSectorAssessment && <p className="fs-14 fw-500 text-3-color mb-3">Uploaded by applicant.</p>} */}
      <div className="row">
        {pictures.map(picture => (
          <div key={picture.id} className="col-12 col-md-6 mb-3">
            <div className="site-card" onClick={() => handleOpenModal(picture)} style={{ cursor: 'pointer' }}>
              <div className="site-image-wrapper">
                <img
                  src={picture && getImageUrl(picture)}
                  alt={picture.title || 'Site Picture'}
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
              <h5 className="uploader-name margin-right-10 mb-0 mt-2">
                Uploaded by: <span className="text-1-color">{getUploaderName(picture)}</span>
              </h5>
              <h5 className="uploader-name margin-right-10 mb-0">
                Designation: <span className="text-1-color">{formatUploaderDesignation(picture)}</span>
              </h5>
            </div>
          </div>
        ))}
      </div>

      <SitePictureDetailsModal
        open={modalOpen}
        onClose={handleCloseModal}
        selectedPicture={
          selectedPicture
            ? {
                ...selectedPicture,
                teamMember: {
                  ...selectedPicture.teamMember,
                  user: { ...selectedPicture.teamMember?.user, firstName: getUploaderName(selectedPicture) },
                },
              }
            : null
        }
        modalImageLoading={modalImageLoading}
        modalImageSrc={modalImageSrc}
      />
    </>
  );
};

export default SitePictures;
