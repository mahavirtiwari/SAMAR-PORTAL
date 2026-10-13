import { useEffect, useRef, useState } from 'react';
import Images from '../../constants/Images';
import { fetchAuthenticatedImageUrl } from '../../utils/FileUtils';
import { formatCoordinates, formatDateTime } from '../../utils/formatters';
import { Logger } from '../../utils/logger';
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
    if (modalBlobRef.current) {
      try {
        URL.revokeObjectURL(modalBlobRef.current);
      } catch {
        Logger.warn('Failed to revoke modal blob URL');
      }
      modalBlobRef.current = null;
    }
  };

  const [imageUrls, setImageUrls] = useState({});
  const blobUrlsRef = useRef({});
  const modalBlobRef = useRef(null);
  const [modalImageSrc, setModalImageSrc] = useState(null);
  const [modalImageLoading, setModalImageLoading] = useState(false);

  // Key the blob fetch on the evidence ids, not the `evidence` object reference
  // or its downloadUrl. The parent rebuilds `evidence` on every render (and the
  // Save flow fires several re-renders), and the post-save refetch hands back a
  // fresh downloadUrl for the same image — either would re-fetch and revoke the
  // blob URLs, blinking the <img>. The id is stable across refetches, so the same
  // images never refetch. Falls back to downloadUrl only when an id is absent.
  const evidencePics = Array.isArray(evidence) ? evidence : evidence ? [evidence] : [];
  const evidenceKey = evidencePics.map(pic => pic?.id ?? pic?.downloadUrl ?? '').join('|');

  useEffect(() => {
    const load = async () => {
      const pics = Array.isArray(evidence) ? evidence : evidence ? [evidence] : [];
      if (pics.length === 0) {
        setImageUrls({});
        return;
      }

      const promises = pics.map(async pic => {
        if (!pic || !pic.id || !pic.downloadUrl) {
          return null;
        }
        try {
          const blobUrl = await fetchAuthenticatedImageUrl(pic.downloadUrl);
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
  }, [evidenceKey]);

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
  return (
    <div className="site-tour-image-container">
      <div className="site-card" onClick={() => handleOpen()} style={{ cursor: 'pointer' }}>
        <div className="site-image-wrapper" style={{ height: 'auto' }}>
          {(() => {
            const pics = Array.isArray(evidence) ? evidence : evidence ? [evidence] : [];
            const first = pics[0];
            const thumb = first ? imageUrls[first.id] : null;
            return <img src={thumb} alt="Site Interior" className="evidence-site-image" onError={e => (e.target.src = Images.dummySite)} />;
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
