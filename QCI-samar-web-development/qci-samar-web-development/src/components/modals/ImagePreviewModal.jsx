import { useEffect, useRef, useState } from 'react';
import { fetchAuthenticatedImageUrl } from '../../utils/FileUtils';
import AppCommonModal from './AppCommonModal';

const ImagePreviewModal = ({ show, onClose, src, alt = 'preview' }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    const loadImage = async () => {
      // Modal is closing — keep the current image mounted so it fades out cleanly
      // instead of flashing an empty "No image available" state for the duration of
      // the dialog's close transition. The cleanup below revokes the blob on unmount
      // or before the next load.
      if (!show) {
        setError(null);
        return;
      }

      // Clean up previous blob URL before loading a new one
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      if (!src) {
        setImageSrc(null);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const blobUrl = await fetchAuthenticatedImageUrl(src);
        if (blobUrl) {
          // Only own (and later revoke) the blob when we actually created it — i.e.
          // src was a remote URL we fetched. If the caller handed us an already-usable
          // blob:/data: URL, fetchAuthenticatedImageUrl returns it unchanged; revoking
          // that would break the caller's still-mounted image (e.g. a thumbnail).
          blobUrlRef.current = blobUrl === src ? null : blobUrl;
          setImageSrc(blobUrl);
        } else {
          setError('Unable to load image');
        }
      } catch {
        setError('Error loading image');
      } finally {
        setIsLoading(false);
      }
    };

    loadImage();

    // Cleanup on unmount or when modal closes
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [show, src]);

  const modalContent = (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
      {isLoading ? (
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading image...</p>
        </div>
      ) : error ? (
        <div className="text-center text-danger">{error}</div>
      ) : imageSrc ? (
        <img src={imageSrc} alt={alt} style={{ maxWidth: '100%', maxHeight: '70vh' }} />
      ) : (
        <div className="text-center">No image available</div>
      )}
    </div>
  );

  return (
    <AppCommonModal
      open={show}
      onClose={onClose}
      handleClose={onClose}
      modalHeader={'Image Preview'}
      modalContent={modalContent}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '800px', lg: '900px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default ImagePreviewModal;
