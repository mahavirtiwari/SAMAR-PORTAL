import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Icons from '../../constants/Icons';
import useGeolocation from '../../hooks/useGeolocation';
import { punchInAction, punchOutAction } from '../../redux/action/common/ApplicationAssessmentAction';
import { getDeviceMetadata } from '../../utils/deviceInfo';
import { formatDate, formatTime } from '../../utils/formatters';
import { getFirstServerError } from '../../utils/serverErrorUtils';
import { AppButton, AppWebcamCapture } from '../base';
import AppCommonModal from './AppCommonModal';
import AppModal from './AppModal';

/**
 * Selfie + best-effort geo capture for a service-sector web punch. Geo is never
 * blocking — a denied/unavailable location still records the punch (snake_case
 * multipart keys match the backend field names).
 */
const PunchModal = ({ open, onClose, mode, assessmentId, onSuccess }) => {
  const dispatch = useDispatch();
  const { punchActionLoading } = useSelector(state => state.ApplicationAssessment);
  const { getPosition } = useGeolocation();

  const [selfieFile, setSelfieFile] = useState(null);
  const [capturedAt, setCapturedAt] = useState(null);
  const [coords, setCoords] = useState(null);
  const [geoResolved, setGeoResolved] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [cameraStreaming, setCameraStreaming] = useState(false);
  const webcamRef = useRef(null);

  const isPunchOut = mode === 'out';
  const title = isPunchOut ? 'Punch-Out' : 'Punch-In';

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelfieFile(null);
    setCapturedAt(null);
    setCoords(null);
    setGeoResolved(false);
    setSubmitError(null);
    setSuccess(null);
    getPosition().then(position => {
      setCoords(position);
      setGeoResolved(true);
    });
  }, [open, getPosition]);

  useEffect(() => {
    if (!success || !open) {
      return undefined;
    }
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [success, open, onClose]);

  const handleCapture = useCallback(file => {
    setSelfieFile(file);
    setCapturedAt(file ? new Date() : null);
  }, []);

  const handleSubmit = async () => {
    if (!selfieFile) {
      return;
    }
    setSubmitError(null);
    const device = getDeviceMetadata();
    const recordedAt = new Date().toISOString();
    const formData = new FormData();
    formData.append('selfie', selfieFile);
    if (coords?.latitude != null && coords?.longitude != null) {
      formData.append('latitude', coords.latitude);
      formData.append('longitude', coords.longitude);
    }
    formData.append('recordedAt', recordedAt);
    formData.append('deviceMetadata[deviceModel]', device.deviceModel);
    formData.append('deviceMetadata[osVersion]', device.osVersion);
    formData.append('deviceMetadata[appVersion]', device.appVersion);
    // crypto.randomUUID exists only on secure (HTTPS/localhost) origins.
    formData.append('clientUuid', crypto?.randomUUID ? crypto.randomUUID() : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    try {
      const action = isPunchOut ? punchOutAction : punchInAction;
      await dispatch(action({ assessmentId, formData })).unwrap();
      // Refresh the underlying attendance/punch status, then show confirmation.
      onSuccess?.();
      setSuccess({ recordedAt, coords });
    } catch (error) {
      setSubmitError(getFirstServerError(error) || 'Failed to record punch. Please try again.');
    }
  };

  const _locationUnavailable = geoResolved && !coords;

  const captureContent = (
    <div>
      {!selfieFile && <p className="fs-13 fw-500 text-3-color mb-3">Take a selfie to confirm your {isPunchOut ? 'punch-out' : 'punch-in'} at the assessment site.</p>}
      <AppWebcamCapture
        ref={webcamRef}
        onCapture={handleCapture}
        onStreamingChange={setCameraStreaming}
        hideCaptureButton
        disabled={punchActionLoading}
        fileNamePrefix={isPunchOut ? 'punch-out' : 'punch-in'}
        allowUpload={false}
        renderPreview={({ previewUrl }) => (
          <div className="d-flex flex-column align-items-center">
            <img src={previewUrl} alt="Captured selfie" style={{ width: 300, height: 300, maxWidth: '100%', borderRadius: '50%', border: '8px solid #f3f4f8', objectFit: 'cover' }} />
            <div className="margin-top-24 text-center">
              <p className="fs-14 fw-600 heading-color mb-2">
                <img src={Icons.calendar} className="me-1" alt="calendar" style={{ width: 16, height: 16 }} />
                {formatDate(capturedAt || new Date())}, {formatTime(capturedAt || new Date())}
              </p>
            </div>
          </div>
        )}
      />

      {submitError && <p className="fs-12 fw-500 text-danger margin-top-12 mb-0">{submitError}</p>}
    </div>
  );

  if (success) {
    return (
      <AppModal
        show={open}
        handleClose={onClose}
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        image={Icons.successCircle}
        header={isPunchOut ? 'Successfully Punched Out!' : 'Successfully Punched In!'}>
        <div className="text-center margin-top-24">
          <p className="fs-16 fw-500 text-2-color mb-2">
            <img src={Icons.clockGrey} className="at-icon-img me-1" alt="clock" />
            {formatDate(success.recordedAt)}, {formatTime(success.recordedAt)}
          </p>
          {success.coords?.latitude != null && success.coords?.longitude != null ? (
            <p className="fs-14 fw-500 text-2-color mb-0">
              <img src={Icons.locationGrey} className="at-icon-img me-1" alt="location" />
              {Number(success.coords.latitude).toFixed(6)}, {Number(success.coords.longitude).toFixed(6)}
            </p>
          ) : (
            <p className="fs-14 fw-500 text-2-color mb-0">Recorded without GPS coordinates.</p>
          )}
        </div>
      </AppModal>
    );
  }

  const modalFooter = selfieFile ? (
    <div className="modal-double-btn justify-content-end">
      <AppButton size="small" variant="success" title={title} onClick={handleSubmit} loading={punchActionLoading} disabled={!geoResolved || punchActionLoading} />
    </div>
  ) : (
    <div className="modal-double-btn justify-content-end">
      {/* <AppButton size="small" customClass="tertiary" variant="tertiary" title="Cancel" onClick={onClose} disabled={punchActionLoading} /> */}
      <AppButton size="small" variant="primary" title="Capture" onClick={() => webcamRef.current?.capture()} disabled={!cameraStreaming || punchActionLoading} />
    </div>
  );

  return (
    <AppCommonModal
      open={open}
      onClose={onClose}
      modalHeader={<div>{title}</div>}
      modalContent={captureContent}
      modalFooter={modalFooter}
      paperSx={{ width: { xs: '100%', sm: '90%', md: '750px' }, maxWidth: '98vw' }}
    />
  );
};

export default PunchModal;
