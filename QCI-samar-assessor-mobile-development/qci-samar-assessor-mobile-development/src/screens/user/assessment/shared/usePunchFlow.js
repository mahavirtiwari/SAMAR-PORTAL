import { useEffect, useMemo, useState } from 'react';
import { Animated, AppState, Platform } from 'react-native';
import { useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import AppSettings from '../../../../../appsettings';
import { LOCATION_PUNCH_MAX_AGE_MS } from '../../../../constants/Config';
import {
  getAttendanceStatusAction,
  punchInAction,
  punchOutAction
} from '../../../../redux/action/assessmentAction';
import { prepareCapturedPhoto } from '../../../../services/offline/capturePipeline';
import { deletePhotoFile } from '../../../../services/offline/photoStorage';
import { formatBytes } from '../../../../utils/diskSpace';
import { mapApiError } from '../../../../utils/errorMessages';
import { ensureLocationServicesEnabled, getCurrentCoords } from '../../../../utils/location';
import { Logger } from '../../../../utils/logger';
import { checkAppPermissions, ensurePermission } from '../../../../utils/permissions';
import { showErrorToast, showWarningToast } from '../../../../utils/toast';

const usePunchFlow = ({
  assessmentId,
  assessmentData,
  userData,
  lowStorage,
  diskState,
  dispatch,
  onPunchOutSuccess
}) => {
  const [checkInModalVisible, setCheckInModalVisible] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [selfieUri, setSelfieUri] = useState(null);
  const [rotateValue] = useState(() => new Animated.Value(0));
  // VisionCamera v5 captures through an output attached to the camera session
  // rather than a ref on the view. A capture is only possible once the session
  // has started, so track that explicitly.
  const [isCameraStarted, setIsCameraStarted] = useState(false);

  const device = useCameraDevice('front');
  const { hasPermission, requestPermission: syncCameraPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput({ qualityPrioritization: 'quality' });
  // Wiring for PunchModal's <Camera>: the photo output to attach and the
  // session callbacks that gate capture on the session actually running.
  // Memoized because VisionCamera feeds onError into the session config, so a
  // new identity on every render would reconfigure the session.
  const camera = useMemo(
    () => ({
      photoOutput,
      onStarted: () => setIsCameraStarted(true),
      onStopped: () => setIsCameraStarted(false),
      onError: (error) => {
        setIsCameraStarted(false);
        Logger.error('Selfie camera error:', error?.message || error);
      }
    }),
    [photoOutput]
  );

  const currentTime = new Date()
    .toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour12: true,
      hour: '2-digit',
      minute: '2-digit'
    })
    .replace(/\b(am|pm)\b/i, (period) => period.toUpperCase());

  useEffect(() => {
    if (!showSuccessScreen) {
      return;
    }
    const timer = setTimeout(() => {
      setShowSuccessScreen(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [showSuccessScreen]);

  // Animation for progress ring
  useEffect(() => {
    let isMounted = true;

    if (isCheckingIn) {
      const animate = () => {
        Animated.timing(rotateValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true
        }).start(() => {
          if (isMounted && isCheckingIn) {
            rotateValue.setValue(0);
            animate();
          }
        });
      };
      animate();
    }

    return () => {
      isMounted = false;
      rotateValue.stopAnimation();
    };
  }, [isCheckingIn, rotateValue]);

  const handleCheckInPress = () => {
    if (lowStorage) {
      showWarningToast(
        'Low Storage',
        `You have less than 1GB free (${formatBytes(
          diskState.freeBytes
        )}). Free up space to start the onsite assessment.`
      );
      return;
    }
    setCheckInModalVisible(true);
  };

  // Fired once AppModal's entrance animation finishes. Requesting permissions
  // (and, on grant, mounting the camera) any earlier competes with the still-
  // animating modal for the UI thread, which is what made the open jittery.
  const handleModalOpened = async () => {
    try {
      await requestLocationPermission();
      await requestCameraPermission();
    } catch (error) {
      Logger.error('Punch modal initialization error:', error);
    }
  };

  const requestLocationPermission = async () => {
    const granted = await ensurePermission('location');
    if (granted) {
      getCurrentLocation();
    } else {
      setLocationStatus('failed');
    }
    return granted;
  };

  const requestCameraPermission = async () => {
    const granted = await ensurePermission('camera');
    if (!granted) {
      return;
    }
    // The system dialog was answered via react-native-permissions, but the
    // preview and the selfie gate read VisionCamera's own permission store —
    // it never hears about that grant, so on iOS `hasPermission` stayed false
    // for the whole session and the camera never mounted. Re-requesting here
    // is a no-op dialog-wise (already granted) and syncs the store.
    await syncCameraPermission();
    setIsCameraActive(true);
  };

  // A user who leaves the modal open, backgrounds the app to grant a blocked
  // permission from Settings, then returns previously saw the flow stuck: the
  // permission checks only ever ran at modal-open time. Passively re-check on
  // foreground return (never re-firing the system dialog), but only from the
  // settled 'failed' state, since 'idle'/'fetching' already have their own
  // in-flight retry paths.
  useEffect(() => {
    if (!checkInModalVisible || locationStatus !== 'failed') {
      return;
    }
    const subscription = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') {
        return;
      }
      const { permissions } = await checkAppPermissions();
      if (permissions.location === 'granted') {
        getCurrentLocation();
      }
      if (permissions.camera === 'granted' && !isCameraActive) {
        await syncCameraPermission();
        setIsCameraActive(true);
      }
    });
    return () => subscription.remove();
  }, [checkInModalVisible, locationStatus, isCameraActive]);

  const getCurrentLocation = async () => {
    setLocationStatus('fetching');
    // Device location off would otherwise leave the punch modal spinning on
    // 'fetching' while getCurrentCoords burns its timeout. Detect it up front
    // and show the actionable "Enable Location" alert; on return the toggle is
    // re-read, so enabling it lets a Retry succeed.
    const servicesOn = await ensureLocationServicesEnabled(
      'Location is required to punch in and out. Please turn on Location to continue.'
    );
    if (!servicesOn) {
      setLocationStatus('failed');
      return;
    }
    // Reuse a warm fix up to a minute old (same as the capture gate) so the punch
    // modal doesn't sit on "fetching…" waiting on a fresh — offline, cold and
    // slow — acquisition. The assessor punches standing at the site, so a fix
    // this recent is the same location.
    const coords = await getCurrentCoords({ maximumAge: LOCATION_PUNCH_MAX_AGE_MS });
    if (coords) {
      setUserLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005
      });
      setLocationStatus('done');
      Logger.info('User location:', coords);
    } else {
      setLocationStatus('failed');
      showErrorToast('Location Required', 'Could not fetch your location. Tap Retry to try again.');
    }
  };

  // Captures the selfie through VisionCamera's photo output and returns a
  // file:// URI for the capture pipeline. capturePhotoToFile returns a plain
  // filesystem path; the scheme is added only if missing, since a doubled
  // file://file:/// prefix makes the native compressor write an empty selfie.
  const captureSelfieUri = async () => {
    const photoFile = await photoOutput.capturePhotoToFile({ flashMode: 'off' }, {});
    const path = photoFile.filePath;
    return path.startsWith('file://') ? path : `file://${path}`;
  };

  const handleCheckIn = async () => {
    if (!userLocation) {
      showErrorToast('Location Required', 'Punch-in cannot be recorded without your location.');
      return;
    }
    try {
      setIsCheckingIn(true);

      // Capture selfie photo
      let selfieUriCaptured = null;
      if (isCameraActive && isCameraStarted) {
        try {
          const rawUri = await captureSelfieUri();
          selfieUriCaptured = await prepareCapturedPhoto({
            uri: rawUri,
            serverAssessmentId: assessmentId,
            bucket: 'attendance',
            latitude: userLocation?.latitude,
            longitude: userLocation?.longitude,
            timestamp: new Date(),
            label: 'selfie'
          });
          setSelfieUri(selfieUriCaptured);
          Logger.info('Selfie captured and persisted:', selfieUriCaptured);
        } catch (photoError) {
          Logger.error('Error capturing selfie:', photoError);
        }
      }
      // The server rejects a punch without a selfie, and queueing one without
      // the file would wedge the outbox — so a failed capture blocks the punch.
      if (!selfieUriCaptured) {
        setIsCheckingIn(false);
        showErrorToast(
          'Selfie Required',
          'Could not capture your selfie. Make sure the camera preview is visible and try again.'
        );
        return;
      }

      const teamMembers = assessmentData?.assessment?.teamMembers || [];
      const currentMember = teamMembers.find(
        (m) => m?.userId === userData?.user?.id || m?.user?.id === userData?.user?.id
      );
      const deviceMetadata = {
        deviceModel: Platform.OS === 'ios' ? 'iOS Device' : 'Android Device',
        osVersion: `${Platform.OS} ${Platform.Version}`,
        appVersion: AppSettings.VERSION_DISPLAY
      };

      // Offline-first: persists to SQLite + outbox and hands the row to the
      // drain; resolves either way. See services/offline/recordPunchIn.
      const result = await dispatch(
        punchInAction({
          assessmentId,
          teamMemberId: currentMember?.id ?? currentMember?.teamMemberId ?? currentMember?.userId,
          userId: userData?.user?.id,
          selfieUri: selfieUriCaptured,
          latitude: userLocation?.latitude,
          longitude: userLocation?.longitude,
          deviceMetadata
        })
      ).unwrap();

      setIsCheckingIn(false);
      setCheckInModalVisible(false);
      setShowSuccessScreen(true);
      setSelfieUri(null);

      // Only re-pull status when the punch synced inline. When it's only
      // queued (offline), the optimistic reducer already reflects the punch;
      // re-fetching would offline-fail and clobber it back to Punch-In.
      if (result?.synced) {
        dispatch(getAttendanceStatusAction(assessmentId));
      }
    } catch (error) {
      Logger.error('Check-in error:', error);
      setIsCheckingIn(false);
      const message = typeof error === 'string' ? error : mapApiError(error);
      showErrorToast('Punch-In Failed', message || 'Could not record punch-in. Please try again.');
    }
  };

  const handlePunchOut = () => {
    setCheckInModalVisible(true);
  };

  const handlePunchOutConfirm = async () => {
    if (!userLocation) {
      showErrorToast('Location Required', 'Punch-out cannot be recorded without your location.');
      return;
    }
    // Declared outside the try so a refused punch can still drop the file.
    let selfieUriCaptured = null;
    try {
      setIsCheckingIn(true);

      // Capture selfie photo (front camera via vision-camera)
      if (isCameraActive && isCameraStarted) {
        try {
          const rawUri = await captureSelfieUri();
          selfieUriCaptured = await prepareCapturedPhoto({
            uri: rawUri,
            serverAssessmentId: assessmentId,
            bucket: 'attendance',
            latitude: userLocation?.latitude,
            longitude: userLocation?.longitude,
            timestamp: new Date(),
            label: 'selfie'
          });
          setSelfieUri(selfieUriCaptured);
          Logger.info('Punch-out selfie captured and persisted:', selfieUriCaptured);
        } catch (photoError) {
          Logger.error('Error capturing punch-out selfie:', photoError);
        }
      }
      // Same gate as punch-in — the server rejects a punch without a selfie.
      if (!selfieUriCaptured) {
        setIsCheckingIn(false);
        showErrorToast(
          'Selfie Required',
          'Could not capture your selfie. Make sure the camera preview is visible and try again.'
        );
        return;
      }

      const teamMembers = assessmentData?.assessment?.teamMembers || [];
      const currentMember = teamMembers.find(
        (m) => m?.userId === userData?.user?.id || m?.user?.id === userData?.user?.id
      );

      const deviceMetadata = {
        deviceModel: Platform.OS === 'ios' ? 'iOS Device' : 'Android Device',
        osVersion: `${Platform.OS} ${Platform.Version}`,
        appVersion: AppSettings.VERSION_DISPLAY
      };
      // Offline-first: persists locally + outbox and hands the row to the drain.
      const result = await dispatch(
        punchOutAction({
          assessmentId,
          teamMemberId: currentMember?.id ?? currentMember?.teamMemberId ?? currentMember?.userId,
          userId: userData?.user?.id,
          selfieUri: selfieUriCaptured,
          latitude: userLocation?.latitude,
          longitude: userLocation?.longitude,
          deviceMetadata
        })
      ).unwrap();

      setIsCheckingIn(false);
      setCheckInModalVisible(false);
      setShowSuccessScreen(true);
      setSelfieUri(null);

      // Only re-pull status when the punch synced inline (see handleCheckIn).
      if (result?.synced) {
        dispatch(getAttendanceStatusAction(assessmentId));
      }

      if (onPunchOutSuccess) {
        await onPunchOutSuccess();
      }
    } catch (error) {
      Logger.error('Punch-out error:', error);
      setIsCheckingIn(false);
      // The selfie was persisted before the punch was recorded; a refused punch
      // has no row pointing at it, so drop the file instead of orphaning it.
      if (selfieUriCaptured) {
        deletePhotoFile(selfieUriCaptured).catch(() => undefined);
        setSelfieUri(null);
      }
      const message = typeof error === 'string' ? error : mapApiError(error);
      showErrorToast(
        'Punch-Out Failed',
        message || 'Could not record punch-out. Please try again.'
      );
    }
  };

  const handleSuccessComplete = () => {
    setShowSuccessScreen(false);
  };

  const closeCheckInModal = () => {
    setCheckInModalVisible(false);
    setIsCameraActive(false);
    setIsCameraStarted(false);
    setUserLocation(null);
    setLocationStatus('idle');
    setIsCheckingIn(false);
    setShowSuccessScreen(false);
    setSelfieUri(null);
    rotateValue.stopAnimation();
  };

  return {
    checkInModalVisible,
    isCheckingIn,
    showSuccessScreen,
    userLocation,
    locationStatus,
    retryLocation: requestLocationPermission,
    isCameraActive,
    selfieUri,
    camera,
    device,
    hasPermission,
    currentTime,
    handleCheckInPress,
    handleModalOpened,
    handlePunchOut,
    handleCheckIn,
    handlePunchOutConfirm,
    handleSuccessComplete,
    closeCheckInModal
  };
};

export default usePunchFlow;
