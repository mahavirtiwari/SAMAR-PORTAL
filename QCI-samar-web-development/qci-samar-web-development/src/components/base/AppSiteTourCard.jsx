import { useEffect, useState } from 'react';
import Images from '../../constants/Images';
import { getCachedImageUrl } from '../../utils/FileUtils';
import { formatDateTime } from '../../utils/formatters';
import SitePictureDetailsModal from '../modals/SitePictureDetailsModal';

const AppSiteTourCard = ({ picture, lat, long, dateString, uploader = '-' }) => {
  const [open, setOpen] = useState(false);
  const [selectedPicture, setSelectedPicture] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [modalImageSrc, setModalImageSrc] = useState(null);
  const [modalImageLoading, setModalImageLoading] = useState(false);

  const handleOpen = pic => {
    const toOpen = pic || picture;
    setSelectedPicture(toOpen || null);
    setOpen(true);
    setModalOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedPicture(null);
    setModalOpen(false);
  };

  // Preload the thumbnail. Blob URLs come from the shared image cache, which owns and
  // revokes them, so a re-render or live refresh with the same picture costs nothing.
  const thumbSource = picture?.downloadUrl || null;
  useEffect(() => {
    setImageSrc(null);
    if (!thumbSource) {
      return undefined;
    }
    let cancelled = false;
    getCachedImageUrl(thumbSource, { thumb: true }).then(blobUrl => {
      if (!cancelled && blobUrl) {
        setImageSrc(blobUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [thumbSource]);

  // Load the full-size image when the modal opens.
  useEffect(() => {
    const src = selectedPicture?.downloadUrl || null;
    setModalImageSrc(null);
    if (!modalOpen || !src) {
      setModalImageLoading(false);
      return undefined;
    }
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

  return (
    <>
      <div className="site-tour-container">
        {/* Evidence photos carry the assessor's comment as `description` rather than `title`. */}
        <h3>{picture?.title || picture?.description || 'Site Photo'}</h3>
        <div className="site-tour-image-container">
          <div className="site-card" onClick={() => handleOpen()} style={{ cursor: 'pointer' }}>
            <div className="site-image-wrapper">
              <img
                src={imageSrc || Images.dummySite}
                loading="lazy"
                alt={picture?.title || picture?.description || 'Site photo'}
                className="site-image"
                onError={e => (e.target.src = Images.dummySite)}
              />
              <div className="site-overlay">
                {lat && long ? (
                  <div className="overlay-text">
                    {lat}, {long}
                  </div>
                ) : null}
                <div className="overlay-text">{dateString || formatDateTime(picture?.capturedAt)}</div>
              </div>
            </div>
          </div>
        </div>
        <h5 className="uploader-name margin-right-10 mb-0">
          Uploaded by: <span className="text-1-color">{uploader}</span>
        </h5>
      </div>
      <SitePictureDetailsModal open={open} onClose={handleClose} selectedPicture={selectedPicture || picture} modalImageLoading={modalImageLoading} modalImageSrc={modalImageSrc} />
    </>
  );
};

export default AppSiteTourCard;
