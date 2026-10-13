import PropTypes from 'prop-types';
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { Logger } from '../../utils/logger';
import AppButton from './AppButton';

const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 480;

// Some browsers leave getUserMedia pending (never resolve or reject) when the
// permission prompt is dismissed with its X instead of Allow/Block. Without a
// reveal after this delay the loader spins forever and the upload fallback is
// unreachable, so a dismissed prompt fully blocks the punch. A genuinely working
// camera streams well within this window, so the fallback stays hidden then.
const CAMERA_SLOW_START_MS = 6000;

/**
 * Front-camera still capture. Mirrors the mobile selfie semantics: capture a JPEG
 * and hand a `File` to the parent.
 *
 * `allowUpload` controls every "upload a photo instead" affordance, including the
 * emergency file-picker fallback shown when the camera is unavailable or permission
 * is denied. When false (e.g. punch attendance, which must be a live selfie), no
 * path lets the user submit a gallery photo in place of a live capture; a denied
 * or broken camera leaves only Retry.
 *
 * `hideCaptureButton` suppresses the inline Capture button for parents that drive
 * capture from their own chrome (e.g. a modal footer) via `ref.current.capture()`;
 * `onStreamingChange` lets them enable that control only while the camera is live.
 *
 * @param {(file: File|null, previewUrl: string|null) => void} onCapture
 */
const AppWebcamCapture = ({ ref, onCapture, disabled = false, fileNamePrefix = 'capture', allowUpload = true, renderPreview, autoStart = true, hideCaptureButton = false, onStreamingChange }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const startAttemptRef = useRef(0);

  const [streaming, setStreaming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [slowStart, setSlowStart] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStreaming(false);
  }, []);

  const startCamera = useCallback(async () => {
    // Each call takes a token; a StrictMode remount (or a manual retry) supersedes
    // any in-flight attempt, whose late result/error must not touch the UI or the
    // loader would give way to a spurious "could not start camera" flash.
    const attempt = ++startAttemptRef.current;
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(allowUpload ? 'Camera is not available in this browser. Please upload a photo instead.' : 'Camera is not available in this browser.');
      return;
    }
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT },
        audio: false,
      });
      if (attempt !== startAttemptRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch (error) {
      if (attempt !== startAttemptRef.current) {
        return;
      }
      Logger.error('AppWebcamCapture.startCamera failed:', error?.message);
      // A denied permission cannot be re-prompted from JS: the browser won't show the
      // dialog again for this origin until the user flips it in the browser's own site
      // settings. Say that explicitly so "Retry" isn't mistaken for a broken re-prompt.
      if (error?.name === 'NotAllowedError') {
        setCameraError(
          allowUpload
            ? 'Camera permission was denied. Enable camera access for this site in your browser settings, then retry, or upload a photo instead.'
            : 'Camera permission was denied. Enable camera access for this site in your browser settings, then retry.',
        );
      } else {
        setCameraError(allowUpload ? 'Could not start the camera. Retry, or upload a photo instead.' : 'Could not start the camera. Retry.');
      }
    } finally {
      if (attempt === startAttemptRef.current) {
        setStarting(false);
      }
    }
  }, [allowUpload]);

  // Stop the camera when the component unmounts.
  useEffect(() => stopStream, [stopStream]);

  // Open the camera as soon as the picker mounts, so the user does not have to
  // click a second "Start Camera" button after choosing Capture Picture.
  useEffect(() => {
    if (autoStart && !disabled) {
      startCamera();
    }
    // Runs once on mount: re-running on prop churn would restart a live stream.
  }, []);
  // Revoke the object URL when the preview changes/unmounts to avoid leaks.
  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  const setPreview = useCallback((url, file) => {
    setPreviewUrl(prev => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return url;
    });
    onCapture?.(file, url);
    // onCapture is intentionally read fresh each call; guarded by parent memoization.
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || CAPTURE_WIDTH;
    canvas.height = video.videoHeight || CAPTURE_HEIGHT;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      blob => {
        if (!blob) {
          return;
        }
        const file = new File([blob], `${fileNamePrefix}-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setPreview(URL.createObjectURL(blob), file);
        stopStream();
      },
      'image/jpeg',
      0.9,
    );
  }, [fileNamePrefix, setPreview, stopStream]);

  useImperativeHandle(ref, () => ({ capture: capturePhoto }), [capturePhoto]);

  useEffect(() => {
    onStreamingChange?.(streaming);
  }, [streaming, onStreamingChange]);

  // Reveal the upload fallback if the camera hasn't started within the grace
  // window (a dismissed permission prompt can leave getUserMedia pending). The
  // timer resets whenever the start settles into streaming or an error.
  useEffect(() => {
    if (!starting) {
      setSlowStart(false);
      return undefined;
    }
    const timer = setTimeout(() => setSlowStart(true), CAMERA_SLOW_START_MS);
    return () => clearTimeout(timer);
  }, [starting]);

  const handleFileFallback = useCallback(
    event => {
      const file = event.target.files?.[0];
      // Reset so re-selecting the same file still fires onChange.
      event.target.value = '';
      if (!file) {
        return;
      }
      // Supersede any in-flight (or dismissed-but-pending) camera start so a
      // late-resolving stream can't keep the camera live behind the chosen photo.
      startAttemptRef.current += 1;
      stopStream();
      setPreview(URL.createObjectURL(file), file);
      setCameraError(null);
    },
    [setPreview, stopStream],
  );

  const retake = useCallback(() => {
    setPreview(null, null);
    startCamera();
  }, [setPreview, startCamera]);

  return (
    <div className="webcam-capture">
      <input ref={fileInputRef} type="file" accept="image/*" className="d-none" onChange={handleFileFallback} disabled={disabled} />

      {previewUrl ? (
        renderPreview ? (
          renderPreview({ previewUrl, fileInputRef, retake })
        ) : (
          <div className="webcam-capture-preview">
            <img src={previewUrl} alt="Captured" style={{ width: '100%', maxWidth: CAPTURE_WIDTH, borderRadius: 8, objectFit: 'cover' }} />
            <div className="d-flex gap-2 margin-top-8">
              <AppButton size="small" variant="tertiary" title="Retake" onClick={retake} disabled={disabled} />
              {allowUpload && <AppButton size="small" variant="link" title="Upload instead" onClick={() => fileInputRef.current?.click()} disabled={disabled} />}
            </div>
          </div>
        )
      ) : (
        <div className="webcam-capture-live">
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 8, background: '#000', display: streaming ? 'block' : 'none', transform: 'scaleX(-1)' }} />
          {!streaming && (
            <div
              className="webcam-capture-placeholder d-flex flex-column align-items-center justify-content-center"
              style={{ minHeight: 180, ...(cameraError ? { border: '1px dashed var(--border-color, #d5d7da)', borderRadius: 8 } : {}) }}>
              {!cameraError && !slowStart && (
                <Spinner animation="border" size="sm" role="status" className="text-primary mb-2">
                  <span className="visually-hidden"></span>
                </Spinner>
              )}
              {cameraError && <p className="fs-13 fw-500 text-3-color mb-2 text-center px-3">{cameraError}</p>}
              {slowStart && !cameraError && (
                <p className="fs-12 fw-500 text-3-color mb-2 text-center px-3">Camera is taking longer than usual. Retry{allowUpload ? ', or upload a photo instead.' : '.'}</p>
              )}
              {(cameraError || slowStart) && (
                <div className="d-flex gap-2">
                  <AppButton size="small" variant="primary" title="Retry" onClick={startCamera} disabled={disabled} />
                  {allowUpload && <AppButton size="small" variant="tertiary" title="Upload Photo" onClick={() => fileInputRef.current?.click()} disabled={disabled} />}
                </div>
              )}
            </div>
          )}
          {streaming && !hideCaptureButton && (
            <div className="d-flex gap-2 margin-top-8">
              <AppButton size="small" variant="primary" title="Capture" onClick={capturePhoto} disabled={disabled} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

AppWebcamCapture.propTypes = {
  onCapture: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  fileNamePrefix: PropTypes.string,
  allowUpload: PropTypes.bool,
  renderPreview: PropTypes.func,
  hideCaptureButton: PropTypes.bool,
  onStreamingChange: PropTypes.func,
};

export default AppWebcamCapture;
