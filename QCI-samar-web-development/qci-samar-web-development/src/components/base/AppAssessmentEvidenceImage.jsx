import { useEffect, useState } from 'react';
import Images from '../../constants/Images';
import { onActivate } from '../../utils/a11y';
import { getCachedImageUrl } from '../../utils/FileUtils';
import { formatCoordinates, formatDateTime } from '../../utils/formatters';
import SitePictureDetailsModal from '../modals/SitePictureDetailsModal';

const AppAssessmentEvidenceImage = ({ evidence }) => {
  const [open, setOpen] = useState(false);
  const [selectedPicture, setSelectedPicture] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const handleOpen = pic => {
    const toOpen = pic || (Array.isArray(evidence) ? evidence[0] : evidence);
    setSelectedPicture(toOpen || null);
    setOpen(true);
    setModalOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
    setSelectedPicture(null);
    setModalOpen(false);
  };

  const [imageUrls, setImageUrls] = useState({});
  const [modalImageSrc, setModalImageSrc] = useState(null);
  const [modalImageLoading, setModalImageLoading] = useState(false);

  // Key the blob fetch on the evidence ids, not the `evidence` object reference
  // or its downloadUrl. The parent rebuilds `evidence` on every render (and the
  // Save flow fires several re-renders), and the post-save refetch hands back a
  // fresh downloadUrl for the same image — either would re-fetch and revoke the
  // blob URLs, blinking the <img>. The id is stable across refetches, so the same
  // images never refetch. Falls back to downloadUrl only when an id is absent.
  // The blob URLs themselves belong to the shared image cache, which revokes them on
  // eviction, so nothing is revoked here.
  const evidencePics = Array.isArray(evidence) ? evidence : evidence ? [evidence] : [];
  const evidenceKey = evidencePics.map(pic => pic?.id ?? pic?.downloadUrl ?? '').join('|');

  useEffect(() => {
    const pics = Array.isArray(evidence) ? evidence : evidence ? [evidence] : [];
    let cancelled = false;
    Promise.all(
      pics.map(async pic => {
        if (!pic || !pic.id || !pic.downloadUrl) {
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
  }, [evidenceKey]);

  // Load modal full-size image when selected
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
    <div className="site-tour-image-container">
      <div className="site-card" {...onActivate(() => handleOpen())} style={{ cursor: 'pointer' }}>
        <div className="site-image-wrapper" style={{ height: 'auto' }}>
          {(() => {
            const pics = Array.isArray(evidence) ? evidence : evidence ? [evidence] : [];
            const first = pics[0];
            const thumb = first ? imageUrls[first.id] : null;
            return <img src={thumb} loading="lazy" alt="Site Interior" className="evidence-site-image" onError={e => (e.target.src = Images.dummySite)} />;
          })()}
          <div className="site-overlay">
            {formatCoordinates(evidence?.latitude, evidence?.longitude) && <div className="overlay-text">{formatCoordinates(evidence?.latitude, evidence?.longitude)}</div>}
            <div className="overlay-text">{evidence?.capturedAt ? formatDateTime(evidence.capturedAt) : '-'}</div>
          </div>
        </div>
      </div>
      <SitePictureDetailsModal open={open} onClose={handleClose} selectedPicture={selectedPicture} modalImageLoading={modalImageLoading} modalImageSrc={modalImageSrc} />
    </div>
  );
};

export default AppAssessmentEvidenceImage;
