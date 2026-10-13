import { useEffect, useRef, useState } from 'react';
import Images from '../../constants/Images';
import { fetchAuthenticatedImageUrl } from '../../utils/FileUtils';
import { formatDateTime } from '../../utils/formatters';
import SitePictureDetailsModal from '../modals/SitePictureDetailsModal';

const AppSiteTourCard = ({ picture, lat, long, dateString, uploader = '-' }) => {
  const [open, setOpen] = useState(false);
  const [selectedPicture, setSelectedPicture] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [modalImageSrc, setModalImageSrc] = useState(null);
  const [modalImageLoading, setModalImageLoading] = useState(false);

  const blobUrlRef = useRef(null);
  const modalBlobRef = useRef(null);

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
    if (modalBlobRef.current) {
      try {
        URL.revokeObjectURL(modalBlobRef.current);
      } catch {
        // ignore
      }
      modalBlobRef.current = null;
    }
  };

  // preload thumbnail
  useEffect(() => {
    let cancelled = false;
    const loadThumb = async () => {
      if (!picture || !picture.downloadUrl) {
        setImageSrc(null);
        return;
      }
      try {
        const blobUrl = await fetchAuthenticatedImageUrl(picture.downloadUrl);
        if (!cancelled && blobUrl) {
          blobUrlRef.current = blobUrl;
          setImageSrc(blobUrl);
        }
      } catch {
        // ignore
      }
    };
    loadThumb();
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        try {
          URL.revokeObjectURL(blobUrlRef.current);
        } catch {
          // ignore
        }
        blobUrlRef.current = null;
      }
    };
  }, [picture]);

  // load modal full-size image when opened
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

  return (
    <>
      <div className="site-tour-container">
        <h3>{picture?.title || 'Site Photo'}</h3>
        <div className="site-tour-image-container">
          <div className="site-card" onClick={() => handleOpen()} style={{ cursor: 'pointer' }}>
            <div className="site-image-wrapper">
              <img src={imageSrc || picture?.downloadUrl || Images.dummySite} alt={picture?.title || 'Site Interior'} className="site-image" onError={e => (e.target.src = Images.dummySite)} />
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
