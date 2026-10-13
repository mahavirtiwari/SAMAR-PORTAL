import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  Keyboard,
  Platform,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import RNFS from 'react-native-fs';
import { launchCamera } from 'react-native-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../../../assets/theme/Theme';
import { AppButton, ImageUploaderUI } from '../../../../components';
import SiteTourPickerModal from '../../../../components/assessment/SiteTourPickerModal';
import AppInput from '../../../../components/base/textInput/AppInput';
import { Header } from '../../../../components/layout';
import { AppBottomSheet } from '../../../../components/shared';
import AppScrollView from '../../../../components/shared/AppScrollView';
import Icons from '../../../../constants/Icons';
import {
  AddAssessmentResponse,
  addResponseEvidenceAction,
  deleteResponseEvidenceAction,
  getResponseEvidencesAction
} from '../../../../redux/action/assessmentResponseAction';
import {
  getSiteTourPicturePoolAction,
  getSiteTourPicturesAction
} from '../../../../redux/action/siteAction';
import {
  resetBulkUpdateAssessmentResponsesState,
  resetResponseEvidencesState
} from '../../../../redux/slices/assessmentResponseSlice';
import { persistCapture, stampCapture } from '../../../../services/offline/capturePipeline';
import { getToken } from '../../../../services/storage/authStore';
import { getImagePickerOptions, Logger } from '../../../../utils';
import { mapApiError } from '../../../../utils/errorMessages';
import { acquireCaptureCoords } from '../../../../utils/location';
import { ensurePermission } from '../../../../utils/permissions';
import { showErrorToast, showWarningToast } from '../../../../utils/toast';
import { useApplicationLoader } from '../../../../utils/useApplicationLoader';

// Max evidence images per question — camera captures + picks from the site tour combined.
const MAX_EVIDENCE_IMAGES = 5;

function AssessmentParametersDetails({ route }) {
  const navigation = useNavigation();
  const dispatch = useDispatch();

  // readOnly is the post-punch-out review pass: answers, evidence and remarks
  // render exactly as captured, but nothing on this screen can change them and
  // no save is offered. Arrives from the steps screen via the parameters list.
  const { parameterData, IndividualParameter, readOnly = false } = route?.params || {};
  const refEvidenceSheet = useRef(null);
  // Site Tour picker is a centered Modal (not a bottom sheet); driven by state.
  const [showSiteTourModal, setShowSiteTourModal] = useState(false);

  // State for form data
  // questionResponses: [{ questionId, selectedOption, assessorRemarks }]
  const [questionResponses, setQuestionResponses] = useState([]);
  // evidenceImages: { [questionId]: [{ uri, lat, lng }] }
  const [evidenceImages, setEvidenceImages] = useState({});
  const [deletedEvidenceIds, setDeletedEvidenceIds] = useState({});
  const [selectedSiteTourImages, setSelectedSiteTourImages] = useState([]);
  // The selection the picker opened with — kept in state (not a ref) so the
  // "Select" button's disabled comparison can read it during render safely.
  const [initialSelectedSiteTourImages, setInitialSelectedSiteTourImages] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  // Only clear current question's response if no data is entered (optional, or remove this function entirely)
  // To always preserve previous data, do not clear responses at all when navigating
  // const clearCurrentQuestionResponse = () => undefined;

  // Animate to next/prev question
  // Do not clear any responses when navigating, always preserve previous data
  const animateToQuestion = (nextIndex) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true
    }).start(() => {
      setCurrentQuestionIndex(nextIndex);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      }).start();
    });
  };
  const { bulkUpdateAssessmentResponsesData, responseEvidences } = useSelector(
    (state) => state.assessmentResponse
  );

  const siteTourPictures = useSelector((state) => state.site?.siteTourPictures || { pictures: [] });
  const { assessmentData } = useSelector((state) => state.assessment);

  // Service-sector assessments are conducted online — there's no site visit, so
  // capturing evidence photos via the camera doesn't apply. The capture button
  // is disabled for service (the parent screen keeps assessmentData fresh).
  const sector = assessmentData?.assessment?.application?.sector;
  const isServiceSector = String(sector || '').toLowerCase() === 'service';
  // Dummy Site Tour images

  // Clear any evidence left over in the store from a previously viewed
  // parameter, both on first mount and on unmount, so the first question never
  // briefly shows the previous parameter's images before its own fetch lands.
  useEffect(() => {
    dispatch(resetResponseEvidencesState());
    setEvidenceImages({});
    return () => {
      dispatch(resetResponseEvidencesState());
    };
  }, []);

  useEffect(() => {
    // Service-sector assessments have no assessor site visit, so /mine returns
    // nothing — pull the applicant-uploaded site-tour pool instead (mirrors the
    // sector branch in SiteTour.js). Both actions write the same slice slot.
    if (isServiceSector) {
      dispatch(getSiteTourPicturePoolAction(parameterData.assessmentId));
    } else {
      dispatch(getSiteTourPicturesAction(parameterData.assessmentId));
    }
    // Clear the previous question's evidence immediately so this question
    // doesn't briefly show stale images while its own evidence is fetched.
    dispatch(resetResponseEvidencesState());
    setEvidenceImages({});
    dispatch(
      getResponseEvidencesAction({
        assessmentId: parameterData.assessmentId,
        questionId: parameterData.questions[currentQuestionIndex]?.id
      })
    );
  }, [currentQuestionIndex, isServiceSector]);

  useEffect(() => {
    if (IndividualParameter) {
      setQuestionResponses(
        IndividualParameter?.map((item) => ({
          questionId: item.id,
          selectedOption: item.response?.selectedOption || null,
          assessorRemarks: item.response?.assessorRemarks || ''
        }))
      );
    }
  }, [IndividualParameter]);

  useEffect(() => {
    if (responseEvidences) {
      // Map responseEvidences to the evidenceImages state shape: { [questionId]: [{ uri, latitude, longitude }] }
      const newEvidenceImages = {};
      const questionId = parameterData?.questions?.[currentQuestionIndex]?.id;
      responseEvidences?.evidences?.forEach((ev) => {
        // If questionId is not present in evidence, use current question's id
        const key = ev.questionId || questionId;
        if (key) {
          if (!newEvidenceImages[key]) {
            newEvidenceImages[key] = [];
          }
          newEvidenceImages[key].push({
            uri: ev.fileUrl || ev.downloadUrl || ev.uri,
            latitude: ev.latitude,
            longitude: ev.longitude,
            timestamp: ev.capturedAt,
            description: ev.description,
            sourceSiteTourPictureId: ev.sourceSiteTourPictureId,
            id: ev.id,
            syncState: ev.syncState || 'synced'
          });
        }
      });
      setEvidenceImages(newEvidenceImages);
    }
  }, [responseEvidences, parameterData]);

  // Set selected option for a question
  const handleAnswerSelect = (questionId, optionId) => {
    setQuestionResponses((prev) => {
      const existing = prev.find((r) => r.questionId === questionId);
      if (existing) {
        return prev.map((r) =>
          r.questionId === questionId ? { ...r, selectedOption: optionId } : r
        );
      } else {
        return [...prev, { questionId, selectedOption: optionId, assessorRemarks: '' }];
      }
    });
  };

  // Set assessor remarks for a question
  const handleRemarksChange = (questionId, text) => {
    // Clear the "remarks required" error as soon as the user starts typing.
    if (questionError && text && text.trim().length > 0) {
      setQuestionError('');
    }
    setQuestionResponses((prev) => {
      const existing = prev.find((r) => r.questionId === questionId);
      if (existing) {
        return prev.map((r) => (r.questionId === questionId ? { ...r, assessorRemarks: text } : r));
      } else {
        return [...prev, { questionId, selectedOption: null, assessorRemarks: text }];
      }
    });
  };

  // Evidence functions (per question)
  const _openEvidenceOptions = (questionId) => {
    setActiveEvidenceQuestionId(questionId);
    refEvidenceSheet.current.open();
  };

  const [activeEvidenceQuestionId, setActiveEvidenceQuestionId] = useState(null);
  const openCamera = async (questionId) => {
    refEvidenceSheet.current.close();

    if ((evidenceImages[questionId] || []).length >= MAX_EVIDENCE_IMAGES) {
      showWarningToast(
        'Limit Reached',
        `You can add up to ${MAX_EVIDENCE_IMAGES} images per question.`
      );
      return;
    }

    const cameraGranted = await ensurePermission('camera');
    if (!cameraGranted) {
      return;
    }

    // Evidence photos are geo-verification evidence: obtain a valid fix BEFORE
    // the camera opens and block the capture entirely if none is available, so
    // a coordinate-less photo can never be taken. acquireCaptureCoords shows a
    // single "Location Required" alert and returns null on failure.
    setCapturing(true);
    const coords = await acquireCaptureCoords();
    if (!coords) {
      setCapturing(false);
      return;
    }

    const options = getImagePickerOptions({ maxWidth: 1920, maxHeight: 1920, quality: 0.8 });
    const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024; // 10 MB

    launchCamera(options, async (response) => {
      if (response.didCancel || response.error) {
        Logger.warn('Camera cancelled or error');
        setCapturing(false);
        return;
      }
      const asset = response.assets && response.assets[0];
      if (!asset) {
        setCapturing(false);
        return;
      }

      if (asset.fileSize && asset.fileSize > MAX_EVIDENCE_SIZE) {
        Logger.warn('Evidence file too large:', asset.fileSize);
        showWarningToast(
          'File Too Large',
          `File too large. Maximum size is ${MAX_EVIDENCE_SIZE / (1024 * 1024)}MB.`
        );
        setCapturing(false);
        return;
      }

      const workingUri = asset.uri;
      const timestamp = asset.timestamp || new Date().toISOString();

      // Stamping + persisting takes a moment; `capturing` (already true from the
      // gate above) keeps the UI blocked through it so a fast double-tap can't
      // reopen the camera and queue extra captures before this one is counted.
      try {
        // Persist to durable storage FIRST so the raw camera temp is consumed
        // immediately. Evidence is uploaded only at Save (often minutes later),
        // so it must be durable from the shot. persistCapture throws on an
        // empty/missing capture — ask for a retake instead of saving junk.
        let durableUri;
        try {
          durableUri = await persistCapture({
            uri: workingUri,
            serverAssessmentId: parameterData.assessmentId,
            bucket: 'evidence',
            label: 'evidence photo'
          });
        } catch (error) {
          Logger.error('[evidence] capture persist failed, asking for retake:', error?.message);
          const message = typeof error === 'string' ? error : error?.message;
          showWarningToast(
            'Capture Failed',
            message || 'The photo could not be saved. Please retake it.'
          );
          return;
        }

        // Burn the geotag onto the durable file (best-effort — a stamping error
        // keeps the un-stamped durable capture rather than losing it).
        durableUri = await stampCapture({
          uri: durableUri,
          serverAssessmentId: parameterData.assessmentId,
          bucket: 'evidence',
          latitude: coords.latitude,
          longitude: coords.longitude,
          timestamp,
          label: 'evidence photo'
        });
        Logger.info(`[evidence] captured & persisted for question ${questionId} -> ${durableUri}`);
        setEvidenceImages((prev) => {
          const prevArr = prev[questionId] || [];
          // Atomic backstop: never exceed the cap even if a capture slipped
          // through while another was still processing.
          if (prevArr.length >= MAX_EVIDENCE_IMAGES) {
            showWarningToast(
              'Limit Reached',
              `You can add up to ${MAX_EVIDENCE_IMAGES} images per question.`
            );
            return prev;
          }
          return {
            ...prev,
            [questionId]: [
              ...prevArr,
              {
                uri: durableUri,
                latitude: coords.latitude,
                longitude: coords.longitude,
                syncState: 'pending'
              }
            ]
          };
        });
      } finally {
        setCapturing(false);
      }
    });
  };

  const _requestLocationPermission = async () => ensurePermission('location');

  // Normalize a timestamp to epoch millis so ISO strings with differing
  // precision/timezone still compare equal; null when absent/unparseable.
  const toMillis = (value) => {
    if (!value) {
      return null;
    }
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
  };

  // Tolerant coordinate compare — the server can round-trip lat/lng at a
  // different precision than the picture pool, so exact string equality drops
  // valid matches. ~1e-6 degrees is well under a metre.
  const coordsMatch = (a, b) => {
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      return false;
    }
    return Math.abs(na - nb) < 1e-6;
  };

  // Whether a site tour picture is the source of an evidence image. Match keys,
  // strongest first:
  //   1. sourceSiteTourPictureId — the picture's id, stamped onto the evidence at
  //      upload. The authoritative link; used once the backend stores & returns it.
  //   2. description — the picture's title, stamped onto the evidence at upload.
  //      A stored text field, so it survives the server round-trip cleanly (the
  //      capturedAt/coords fallbacks below don't). Mirrors the web client.
  //   3. URL — an in-session pick stores the picture's downloadUrl as the uri.
  //   4. capturedAt — a saved pick inherits the picture's timestamp. Fallback for
  //      legacy evidence saved before the description link existed.
  //   5. Coordinates — last resort, tolerant compare.
  // A locally captured camera photo (file:// path) is never a site tour pick:
  // excluding it stops a camera shot taken at a picture's location (cached GPS)
  // or instant from being misclassified as site-tour evidence.
  const isSiteTourMatchingEvidence = (pic, evidence) => {
    if (
      evidence.sourceSiteTourPictureId != null &&
      pic.id != null &&
      String(evidence.sourceSiteTourPictureId) === String(pic.id)
    ) {
      return true;
    }
    if (evidence.description && pic.title && evidence.description === pic.title) {
      return true;
    }
    if (evidence.uri && pic.downloadUrl && evidence.uri === pic.downloadUrl) {
      return true;
    }
    const isLocalCapture = typeof evidence.uri === 'string' && evidence.uri.startsWith('file://');
    if (isLocalCapture) {
      return false;
    }
    const picTime = toMillis(pic.capturedAt);
    const evTime = toMillis(evidence.timestamp || evidence.capturedAt);
    if (picTime !== null && evTime !== null && picTime === evTime) {
      return true;
    }
    if (
      pic.latitude != null &&
      pic.longitude != null &&
      evidence.latitude != null &&
      evidence.longitude != null &&
      coordsMatch(pic.latitude, evidence.latitude) &&
      coordsMatch(pic.longitude, evidence.longitude)
    ) {
      return true;
    }
    return false;
  };

  const openSiteTourPicker = (questionId) => {
    refEvidenceSheet.current.close();
    const qId = questionId || activeEvidenceQuestionId;
    if (questionId) {
      setActiveEvidenceQuestionId(questionId);
    }
    // Pre-select the site tour pictures already added as evidence for this
    // question. Map each evidence to AT MOST ONE picture (find + dedupe) instead
    // of filtering pictures — otherwise a picture whose coordinates coincide
    // with another (or with a camera shot taken at the same spot) gets selected
    // too, inflating the count past what the user actually picked.
    const currentEvidences = evidenceImages[qId] || [];
    const allPictures = siteTourPictures?.pictures || [];
    const selectedIds = new Set();
    currentEvidences.forEach((ev) => {
      // Dedupe on selectedIds so each evidence claims at most one picture (two
      // pictures sharing a location/timestamp can't both light up for one pick).
      const match = allPictures.find(
        (pic) => !selectedIds.has(pic.id) && isSiteTourMatchingEvidence(pic, ev)
      );
      if (match) {
        selectedIds.add(match.id);
      }
    });
    const alreadySelectedIds = Array.from(selectedIds);
    setSelectedSiteTourImages(alreadySelectedIds);
    setInitialSelectedSiteTourImages(alreadySelectedIds);
    setShowSiteTourModal(true);
  };

  // Returns false when the tap is rejected (limit reached) so the picker modal
  // can surface the warning on its own in-modal FlashMessage — a toast fired
  // here would render behind the modal and be invisible.
  const toggleSiteTourImage = (imageId) => {
    if (selectedSiteTourImages.includes(imageId)) {
      setSelectedSiteTourImages((prev) => prev.filter((id) => id !== imageId));
      return true;
    }

    // Site tour picks share the per-question budget with camera captures, so count
    // the existing non-site-tour (camera) evidence plus what's already selected here.
    const allPictures = siteTourPictures?.pictures || [];
    const currentEvidences = evidenceImages[activeEvidenceQuestionId] || [];
    const cameraCount = currentEvidences.filter(
      (e) => !allPictures.some((pic) => isSiteTourMatchingEvidence(pic, e))
    ).length;

    if (cameraCount + selectedSiteTourImages.length >= MAX_EVIDENCE_IMAGES) {
      return false;
    }

    setSelectedSiteTourImages((prev) => [...prev, imageId]);
    return true;
  };

  const handleSelectSiteTourImages = () => {
    if (activeEvidenceQuestionId) {
      const allPictures = siteTourPictures?.pictures || [];
      const selectedPictures = allPictures.filter((pic) => selectedSiteTourImages.includes(pic.id));
      const prevArr = evidenceImages[activeEvidenceQuestionId] || [];

      // Keep evidence that doesn't match any site tour picture (camera captures,
      // plus any evidence that no longer matches a pool picture). The site-tour
      // subset is rebuilt entirely from the current selection below.
      const nonSiteTourEvidence = prevArr.filter(
        (e) => !allPictures.some((pic) => isSiteTourMatchingEvidence(pic, e))
      );

      // Build new site tour evidence from selected images. Each existing
      // evidence entry may be claimed by AT MOST ONE picture: site-tour
      // pictures often share coordinates/timestamps, so an unclaimed fuzzy
      // find() let several pictures reuse the same entry — the rebuilt list
      // then showed one image N times and uploaded N server copies.
      const claimed = new Set();
      const findExistingEvidence = (img) => {
        const byId = prevArr.find(
          (e) =>
            !claimed.has(e) &&
            e.sourceSiteTourPictureId != null &&
            img.id != null &&
            String(e.sourceSiteTourPictureId) === String(img.id)
        );
        if (byId) {
          claimed.add(byId);
          return byId;
        }
        // Legacy entries saved before the id link existed fall back to the
        // fuzzy matcher — still one claim per entry.
        const fuzzy = prevArr.find(
          (e) =>
            !claimed.has(e) &&
            e.sourceSiteTourPictureId == null &&
            isSiteTourMatchingEvidence(img, e)
        );
        if (fuzzy) {
          claimed.add(fuzzy);
        }
        return fuzzy;
      };
      const siteTourEvidence = selectedPictures.map(
        (img) =>
          findExistingEvidence(img) || {
            uri: img.downloadUrl,
            latitude: img.latitude ?? null,
            longitude: img.longitude ?? null,
            capturedAt: img.capturedAt ?? null,
            // Stable link the picker re-matches on after reload (mirrors web).
            description: img.title ?? null,
            sourceSiteTourPictureId: img.id ?? null,
            // A newly picked site-tour image is not yet saved as evidence for
            // this question — it becomes its own evidence record only on Save.
            syncState: 'pending'
          }
      );

      const finalList = [...nonSiteTourEvidence, ...siteTourEvidence];

      // Hard cap on the true merged set: the per-question image limit must hold
      // no matter how selection/matching was reconstructed. Abort without
      // mutating (modal stays open so the user can deselect) so the count can
      // never exceed the limit.
      if (finalList.length > MAX_EVIDENCE_IMAGES) {
        showWarningToast(
          'Limit Reached',
          `You can add up to ${MAX_EVIDENCE_IMAGES} images per question.`
        );
        return;
      }

      // Any server-saved evidence NOT carried into finalList is an orphan — a
      // deselected pick, or a duplicate the claim set didn't reuse. Queue every
      // such id for deletion; otherwise it survives on the server and the
      // question's image count climbs past the limit on the next reload.
      const orphanedIds = prevArr.filter((e) => e.id && !finalList.includes(e)).map((e) => e.id);
      if (orphanedIds.length > 0) {
        setDeletedEvidenceIds((prevDel) => {
          const existing = prevDel[activeEvidenceQuestionId]
            ? [...prevDel[activeEvidenceQuestionId]]
            : [];
          return {
            ...prevDel,
            [activeEvidenceQuestionId]: [...existing, ...orphanedIds]
          };
        });
      }

      setEvidenceImages((prev) => ({
        ...prev,
        [activeEvidenceQuestionId]: finalList
      }));
    }
    setShowSiteTourModal(false);
    setSelectedSiteTourImages([]);
  };

  // Dismiss without applying: drop the in-progress selection so reopening starts
  // from the question's saved evidence, not a stale pick.
  const closeSiteTourModal = () => {
    setShowSiteTourModal(false);
    setSelectedSiteTourImages([]);
  };

  // Helper function to download remote image to local file
  const downloadImageToLocal = async (remoteUrl) => {
    const token = await getToken('accessToken');
    try {
      const fileName = `evidence_${Date.now()}.jpg`;
      const localPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

      Logger.info('Downloading remote image from URL:', remoteUrl);
      const downloadResult = await RNFS.downloadFile({
        fromUrl: remoteUrl,
        toFile: localPath,
        headers: {
          Authorization: `Bearer ${token?.token}`
          // Add other headers if needed
        }
      }).promise;

      if (downloadResult.statusCode === 200) {
        Logger.info('Image downloaded successfully to:', localPath);
        return Platform.OS === 'android' ? `file://${localPath}` : localPath;
      } else {
        Logger.error('Failed to download image, status:', downloadResult.statusCode);
        return null;
      }
    } catch (error) {
      Logger.error('Error downloading image:', error);
      return null;
    }
  };

  // Save only the current question's answer and evidence via API
  const [questionError, setQuestionError] = useState('');
  const [saving, setSaving] = useState(false);
  // Drives the loader while a freshly captured evidence photo is being stamped
  // and persisted (the slow step). State-driven like `saving` so it survives
  // re-renders, unlike an imperative show/hide from the camera callback.
  const [capturing, setCapturing] = useState(false);
  const handleSave = async () => {
    const currentQuestion = parameterData?.questions[currentQuestionIndex];
    const responseObj = questionResponses.find((r) => r.questionId === currentQuestion.id);
    // Validation: remarks are required
    if (
      !responseObj ||
      !(responseObj.assessorRemarks && responseObj.assessorRemarks.trim().length > 0)
    ) {
      setQuestionError('Please enter remarks for this question.');
      Logger.warn('Validation failed: remarks required');
      return false;
    }
    setQuestionError('');

    // One loader for the whole save: the response plus its N evidence uploads
    // and any deletions all run back-to-back below. Driving the loader from a
    // single `saving` flag keeps it shown once — uploading 50 images no longer
    // flickers the loader 50 times.
    setSaving(true);
    try {
      const val = {
        assessmentId: parameterData.assessmentId,
        questionId: currentQuestion.id,
        data: {
          optionId: responseObj.selectedOption,
          remarks: responseObj.assessorRemarks
        }
      };
      await dispatch(AddAssessmentResponse(val));
      // Save evidence for current question if any
      const MAX_EVIDENCE_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
      const evidenceArr = evidenceImages[currentQuestion.id] || [];
      for (let i = 0; i < evidenceArr.length; i++) {
        const img = evidenceArr[i];

        // Skip already saved evidences (they have an id from the server)
        if (img.id) {
          Logger.info('Skipping already saved evidence with id:', img.id);
          continue;
        }

        // Client-side file size guard before uploading
        if (img.fileSize && img.fileSize > MAX_EVIDENCE_UPLOAD_SIZE) {
          Logger.warn('Evidence file too large, skipping upload:', img.fileSize);
          showWarningToast(
            'File Too Large',
            `File too large. Maximum size is ${MAX_EVIDENCE_UPLOAD_SIZE / (1024 * 1024)}MB.`
          );
          continue;
        }

        let fileUri = img.uri;

        // Site tour image (remote URL) — download to a local file first
        // so the offline orchestrator can persist it durably.
        if (img.uri.startsWith('http')) {
          Logger.info('Remote evidence image detected, downloading first...');
          const localUri = await downloadImageToLocal(img.uri);
          if (!localUri) {
            Logger.error('Failed to download remote image, skipping:', img.uri);
            continue;
          }
          fileUri = localUri;
        }

        await dispatch(
          addResponseEvidenceAction({
            assessmentId: parameterData.assessmentId,
            questionId: currentQuestion.id,
            uri: fileUri,
            latitude: img.latitude,
            longitude: img.longitude,
            capturedAt: img.capturedAt,
            description: img.description,
            sourceSiteTourPictureId: img.sourceSiteTourPictureId
          })
        );
      }

      // Process any deletions the user made locally for this question
      const deletions = deletedEvidenceIds[currentQuestion.id] || [];
      if (deletions.length > 0) {
        for (const evidenceId of Array.from(new Set(deletions))) {
          try {
            await dispatch(
              deleteResponseEvidenceAction({
                assessmentId: parameterData.assessmentId,
                questionId: currentQuestion.id,
                evidenceId: evidenceId
              })
            ).unwrap?.();
            Logger.info('Evidence delete recorded (queued for the drain):', evidenceId);
          } catch (err) {
            Logger.error('Failed to delete evidence during save:', evidenceId, err);
          }
        }
        // Clear deletions for this question
        setDeletedEvidenceIds((prev) => {
          const copy = { ...prev };
          delete copy[currentQuestion.id];
          return copy;
        });
      }
      // Saved successfully. Navigation is handled by the caller (only on a
      // truthy return) so a failed validation/save never advances.
      return true;
    } catch (error) {
      Logger.error('Failed to save response/evidence:', error);
      showErrorToast('Save Failed', mapApiError(error));
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Single loader for the whole save sequence (response + all evidence
  // uploads + deletions). Driven by the local `saving` flag rather than the
  // per-request Redux flags, so a 50-image save shows the loader once instead
  // of flickering it on/off between each upload.
  useApplicationLoader('parameterDetails', saving || capturing);

  useEffect(() => {
    if (bulkUpdateAssessmentResponsesData) {
      dispatch(resetBulkUpdateAssessmentResponsesState());
    }
  }, [bulkUpdateAssessmentResponsesData]);

  const { addResponseEvidenceError } = useSelector((state) => state.assessmentResponse);

  useEffect(() => {
    if (addResponseEvidenceError) {
      showErrorToast(
        'Upload Failed',
        mapApiError(addResponseEvidenceError) || 'Failed to upload evidence. Please try again.'
      );
    }
  }, [addResponseEvidenceError]);

  // Utility to convert question object to options array (supports both array and legacy format)
  const getOptionsArray = (question) => {
    if (Array.isArray(question.options)) {
      // New format: options is an array of { optionText, optionScore }
      return question.options.map((opt, idx) => ({
        id: opt.id || `option${idx + 1}`,
        text: opt.optionText || opt.text || '',
        score: opt.optionScore || opt.score || ''
      }));
    }
    // Legacy format: option1Text, option1Score, ...
    const options = [];
    for (let i = 1; i <= 5; i++) {
      const text = question[`option${i}Text`];
      const score = question[`option${i}Score`];
      if (text) {
        options.push({
          id: i,
          text,
          score
        });
      }
    }
    return options;
  };

  const renderQuestion = (question, index) => {
    if (!question) {
      return null;
    }
    const options = getOptionsArray(question);
    const response = questionResponses.find((r) => r.questionId === question.id) || {};
    return (
      <View key={question.id} style={styles.questionContainer}>
        {/* Question Number and Text */}
        <Text style={styles.questionNumber}>
          QUESTION {index + 1}/
          <Text style={{ color: COLORS.text.tertiary }}>{parameterData?.questions?.length}</Text>
        </Text>
        <View style={styles.questionBox}>
          <Text style={styles.questionText}>
            {question.questionText}
            <Text style={{ color: COLORS.error.main }}>*</Text>
          </Text>
        </View>
        {/* Error message for required validation */}
        <View style={{ marginBottom: Responsive.height(18) }}>
          <Text style={styles.questionText}>Select Options</Text>
        </View>
        {/* Options */}
        {options.map((option, idx) => (
          <TouchableOpacity
            key={option.id}
            style={[
              commonStyles.row,
              commonStyles.alignCenter,
              {
                gap: SPACING.sp10,
                marginBottom: idx === options.length - 1 ? 0 : Responsive.height(12),
                flex: 1
              }
            ]}
            onPress={() => {
              Keyboard.dismiss();
              handleAnswerSelect(question.id, option.id);
            }}
            disabled={readOnly}
            activeOpacity={0.6}>
            <Image
              source={
                response.selectedOption === option.id ? Icons.radioChecked : Icons.radioUnchecked
              }
              style={commonStyles.iconSize18}
            />
            <Text
              style={[
                commonStyles.FontFamily_SemiBold600,
                {
                  color:
                    response.selectedOption === option.id
                      ? COLORS.primary.main
                      : COLORS.text.secondary,
                  fontSize: FONT_SIZE.fs12,
                  width: '90%'
                }
              ]}>
              {option.text}
            </Text>
          </TouchableOpacity>
        ))}
        {/* Evidence Section for this question */}
        <View style={[styles.sectionDivider, { marginTop: Responsive.height(20) }]} />
        <View>
          <Text style={[commonStyles.h2heading600, { marginBottom: Responsive.height(12) }]}>
            Evidence{' '}
            <Text
              style={[
                commonStyles.FontFamily_Medium500,
                { color: COLORS.text.tertiary, fontSize: FONT_SIZE.fs12 }
              ]}>
              (Optional)
            </Text>
          </Text>
          {!readOnly &&
            (!evidenceImages[question.id] || evidenceImages[question.id].length < 5) && (
              <View style={styles.evidenceOptionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.evidenceOptionButton,
                    isServiceSector && { backgroundColor: COLORS.background.accent }
                  ]}
                  onPress={() => openCamera(question.id)}
                  disabled={isServiceSector}
                  activeOpacity={0.6}>
                  <Image
                    source={isServiceSector ? Icons.disabledIcon : Icons.cameraIcon}
                    style={[commonStyles.iconSize40]}
                  />
                  <Text
                    style={[
                      styles.evidenceOptionText,
                      isServiceSector && { color: COLORS.text.tertiary }
                    ]}>
                    Capture Picture
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.evidenceOptionButton}
                  onPress={() => {
                    openSiteTourPicker(question.id);
                  }}
                  activeOpacity={0.6}>
                  <Image source={Icons.siteTour} style={[commonStyles.iconSize35]} />
                  <Text style={styles.evidenceOptionText}>Pick From Site Tour</Text>
                </TouchableOpacity>
              </View>
            )}
          {/* Selected Evidence Images for this question */}
          {evidenceImages[question.id] && evidenceImages[question.id].length > 0 && (
            <FlatList
              data={evidenceImages[question.id]}
              numColumns={2}
              keyExtractor={(_, idx) => idx.toString()}
              style={styles.evidenceList}
              columnWrapperStyle={{ gap: 4 }}
              renderItem={({ item, index }) => (
                <View style={[styles.selectedEvidenceContainer, { margin: 6 }]}>
                  {/* margin for gap between columns */}
                  <ImageUploaderUI
                    image={item.uri}
                    coordinates={{ latitude: item.latitude, longitude: item.longitude }}
                    syncState={item.syncState}
                    isDelete={!readOnly}
                    onDelete={() => {
                      // Remove locally first
                      setEvidenceImages((prev) => {
                        const arr = prev[question.id] ? [...prev[question.id]] : [];
                        arr.splice(index, 1);
                        return { ...prev, [question.id]: arr };
                      });
                      // If this evidence exists on server, mark it for deletion to be processed on Save
                      if (item?.id) {
                        setDeletedEvidenceIds((prev) => {
                          const existing = prev[question.id] ? [...prev[question.id]] : [];
                          return { ...prev, [question.id]: [...existing, item.id] };
                        });
                      }
                    }}
                    showMetadata={true}
                    metadata={
                      item.latitude && item.longitude
                        ? `Latitude: ${item.latitude}, Longitude: ${item.longitude}`
                        : undefined
                    }
                    style={styles.evidenceUploader}
                  />
                </View>
              )}
            />
          )}
        </View>
        {/* Assessor Remarks Section for this question */}
        <View style={styles.sectionDivider} />
        <View>
          <Text style={[commonStyles.h2heading600, { marginBottom: Responsive.height(12) }]}>
            Comment<Text style={{ color: COLORS.error.main }}>*</Text>
          </Text>
          <View style={styles.commentInputContainer}>
            <AppInput
              maxLength={5000}
              placeholderText={'Type your remarks here'}
              multiline={true}
              addressInputStyle={styles.textAlignVertical}
              heightInput={Responsive.height(100)}
              isEditable={!readOnly}
              value={response.assessorRemarks || ''}
              onChange={(text) => handleRemarksChange(question.id, text)}
            />
            <Text style={styles.characterCount}>
              {(response.assessorRemarks || '').length}/5000
            </Text>
          </View>
          {index === currentQuestionIndex && questionError ? (
            <Text
              style={{
                color: COLORS.error.main,
                marginBottom: Responsive.height(8),
                fontSize: FONT_SIZE.fs12
              }}>
              {questionError}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={[commonStyles.fill]}>
      <Header title={parameterData?.name} back={true} />
      <AppScrollView scrollable={true} showLogo={false}>
        <View style={styles.container}>
          {/* Only show one question at a time */}
          <Animated.View
            style={{
              backgroundColor: COLORS.background.primary,
              marginBottom: Responsive.height(4),
              opacity: fadeAnim
            }}>
            {renderQuestion(parameterData?.questions[currentQuestionIndex], currentQuestionIndex)}
          </Animated.View>
        </View>
        <View
          style={[
            commonStyles.padding16,
            {
              backgroundColor: COLORS.background.primary,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderTopWidth: 1,
              borderTopColor: COLORS.border.light
            }
          ]}>
          <View style={{ flex: 1 }}>
            <AppButton
              title={currentQuestionIndex === 0 ? 'Cancel' : 'Previous'}
              variant="soft"
              size="large"
              onPress={() => {
                if (currentQuestionIndex === 0) {
                  navigation.goBack();
                } else {
                  animateToQuestion(currentQuestionIndex - 1);
                }
              }}
            />
          </View>
          {/* Review pass: step through the questions without saving anything. */}
          {readOnly ? (
            <View style={{ flex: 1 }}>
              <AppButton
                title={
                  currentQuestionIndex === parameterData?.questions?.length - 1 ? 'Done' : 'Next'
                }
                size="large"
                backgroundColor={COLORS.button.primary}
                textColor={COLORS.text.inverse}
                onPress={() => {
                  if (currentQuestionIndex === parameterData?.questions?.length - 1) {
                    navigation.goBack();
                  } else {
                    animateToQuestion(currentQuestionIndex + 1);
                  }
                }}
              />
            </View>
          ) : null}
          {/* Save & Next or Save button with disabled color if remarks are missing */}
          {!readOnly &&
            (() => {
              const currentQuestion = parameterData?.questions?.[currentQuestionIndex];
              const responseObj = questionResponses.find(
                (r) => r.questionId === currentQuestion?.id
              );
              const isInvalid =
                !responseObj ||
                !(
                  responseObj.assessorRemarks &&
                  responseObj.assessorRemarks.trim().length > 0 &&
                  responseObj.selectedOption !== null
                );

              // Detect if this question already has a saved response from API
              const originalItem = IndividualParameter?.find(
                (item) => item.id === currentQuestion?.id
              );
              const hasExistingResponse = !!(
                originalItem?.response?.selectedOption || originalItem?.response?.assessorRemarks
              );

              // Detect changes from original values
              const curId = currentQuestion?.id;
              const originalOption = originalItem?.response?.selectedOption || null;
              const originalRemarks = (originalItem?.response?.assessorRemarks || '').trim();
              const currentOption = responseObj?.selectedOption || null;
              const currentRemarks = (responseObj?.assessorRemarks || '').trim();
              const optionChanged = currentOption !== originalOption;
              const remarksChanged = currentRemarks !== originalRemarks;
              const newEvidence = (evidenceImages[curId] || []).some((e) => !e.id);
              const deleted = (deletedEvidenceIds[curId] || []).length > 0;
              const _hasChanges = optionChanged || remarksChanged || newEvidence || deleted;

              // Button disabled only for new responses until filled; existing responses always enabled
              const isButtonDisabled = hasExistingResponse ? false : isInvalid;

              const isLastQuestion = currentQuestionIndex === parameterData?.questions?.length - 1;
              const label = isLastQuestion ? 'Save' : 'Save & Next';

              if (isLastQuestion) {
                return (
                  <View style={{ flex: 1 }}>
                    <AppButton
                      title={label}
                      size="large"
                      backgroundColor={COLORS.button.primary}
                      textColor={COLORS.text.inverse}
                      disabled={isButtonDisabled}
                      onPress={async () => {
                        const saved = await handleSave();
                        if (saved) {
                          navigation.goBack();
                        }
                      }}
                    />
                  </View>
                );
              } else {
                return (
                  <View style={{ flex: 1 }}>
                    <AppButton
                      title={label}
                      size="large"
                      backgroundColor={COLORS.button.primary}
                      textColor={COLORS.text.inverse}
                      disabled={isButtonDisabled}
                      onPress={async () => {
                        const saved = await handleSave();
                        if (saved) {
                          animateToQuestion(currentQuestionIndex + 1);
                        }
                      }}
                    />
                  </View>
                );
              }
            })()}
        </View>
      </AppScrollView>
      {/* Navigation Buttons - always visible at bottom */}

      {/* Evidence Options RBSheet */}
      <AppBottomSheet ref={refEvidenceSheet} snapPoints={[280]}>
        <View style={styles.evidenceSheetContainer}>
          <Text
            style={[
              commonStyles.h2heading600,
              { marginBottom: Responsive.height(20), textAlign: 'center' }
            ]}>
            Add Evidence
          </Text>
          <TouchableOpacity
            style={styles.evidenceSheetButton}
            onPress={openCamera}
            activeOpacity={0.6}>
            <Image source={Icons.cameraIcon} style={[commonStyles.iconSize40]} />
            <Text style={styles.evidenceSheetButtonText}>Capture Picture</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.evidenceSheetButton}
            onPress={openSiteTourPicker}
            activeOpacity={0.6}>
            <Image source={Icons.clipboard} style={[commonStyles.iconSize40]} />
          </TouchableOpacity>
        </View>
      </AppBottomSheet>
      {/* Site Tour Images Modal */}
      <SiteTourPickerModal
        visible={showSiteTourModal}
        pictures={siteTourPictures?.pictures}
        selectedIds={selectedSiteTourImages}
        maxImages={MAX_EVIDENCE_IMAGES}
        onToggle={toggleSiteTourImage}
        onSelect={handleSelectSiteTourImages}
        onClose={closeSiteTourModal}
        selectDisabled={
          selectedSiteTourImages.length === initialSelectedSiteTourImages.length &&
          selectedSiteTourImages.every((id) => initialSelectedSiteTourImages.includes(id))
        }
      />
    </View>
  );
}

const styles = {
  container: { flex: 1 },
  parameterTitle: {
    fontSize: FONT_SIZE.fs18,
    color: COLORS.text.heading,
    ...commonStyles.FontFamily_SemiBold600,
    marginBottom: SPACING.sp24,
    lineHeight: FONT_SIZE.fs22
  },
  questionContainer: {
    paddingHorizontal: SPACING.sp16,
    marginTop: Responsive.height(16),
    flex: 1
  },
  sectionDivider: {
    height: 2,
    backgroundColor: COLORS.background.accent,
    marginHorizontal: -SPACING.sp16,
    marginVertical: Responsive.height(16)
  },
  evidenceList: {
    // Each grid cell carries margin:6, so the last row adds 6px below the
    // images. Cancel it so only the divider's 16px spacing remains.
    marginBottom: -6
  },
  questionTypeBadge: {
    backgroundColor: COLORS.border.light,
    paddingHorizontal: SPACING.sp8,
    paddingVertical: SPACING.sp4,
    borderRadius: BORDER_RADIUS.br4,
    alignSelf: 'flex-start',
    marginBottom: SPACING.sp8
  },
  questionTypeText: {
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.tertiary,
    ...commonStyles.FontFamily_Medium500
  },
  questionNumber: {
    fontSize: FONT_SIZE.fs14,
    color: '#4B5675',
    ...commonStyles.FontFamily_Bold700
  },
  questionText: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    ...commonStyles.FontFamily_SemiBold600
  },
  optionContainer: {
    flexDirection: 'row',
    gap: SPACING.sp12
  },
  radioButton: {
    width: Responsive.width(20),
    height: Responsive.height(20),
    borderRadius: BORDER_RADIUS.br10,
    borderWidth: 2,
    borderColor: COLORS.border.regular,
    marginRight: SPACING.sp12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Responsive.height(2)
  },
  selectedRadio: {
    borderColor: COLORS.primary.main
  },
  radioInner: {
    width: Responsive.width(10),
    height: Responsive.height(10),
    borderRadius: BORDER_RADIUS.br5,
    backgroundColor: COLORS.primary.main
  },
  optionText: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.secondary,
    ...commonStyles.FontFamily_Regular400,
    flex: 1,
    lineHeight: FONT_SIZE.fs18
  },
  selectedOptionText: {
    color: COLORS.primary.main,
    ...commonStyles.FontFamily_Medium500
  },
  evidenceSection: {
    marginBottom: SPACING.sp32
  },
  sectionTitle: {
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.heading,
    ...commonStyles.FontFamily_SemiBold600,
    marginBottom: SPACING.sp12
  },
  optionalText: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.placeholder,
    ...commonStyles.FontFamily_Regular400
  },
  evidenceUploader: {
    marginBottom: 0
  },
  commentsSection: {
    marginBottom: SPACING.sp32
  },
  commentInputContainer: {
    backgroundColor: COLORS.background.secondary,
    borderRadius: BORDER_RADIUS.br8,
    marginBottom: SPACING.sp12,
    position: 'relative'
  },
  textAlignVertical: {
    textAlignVertical: 'top'
  },
  commentInput: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    paddingHorizontal: SPACING.sp16,
    paddingVertical: SPACING.sp12,
    minHeight: Responsive.height(100),
    ...commonStyles.FontFamily_Regular400
  },
  characterCount: {
    position: 'absolute',
    bottom: SPACING.sp8,
    right: SPACING.sp12,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.placeholder,
    ...commonStyles.FontFamily_Regular400
  },
  addCommentButton: {
    backgroundColor: COLORS.border.regular,
    paddingHorizontal: SPACING.sp20,
    paddingVertical: SPACING.sp10,
    borderRadius: BORDER_RADIUS.br6,
    alignSelf: 'flex-start'
  },
  addCommentText: {
    color: COLORS.text.tertiary,
    fontSize: FONT_SIZE.fs14,
    ...commonStyles.FontFamily_Medium500
  },
  saveButton: {
    marginTop: SPACING.sp20
  },
  evidenceOptionsContainer: {
    flexDirection: 'row',
    gap: SPACING.sp16
    // marginBottom: Responsive.height(16)
  },
  evidenceOptionButton: {
    flex: 1,
    backgroundColor: COLORS.background.muted,
    borderRadius: BORDER_RADIUS.br12,
    borderWidth: 2,
    borderColor: COLORS.primary.soft,
    borderStyle: 'dashed',
    paddingVertical: Responsive.height(20),
    alignItems: 'center',
    justifyContent: 'center'
  },
  evidenceOptionText: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.primary.main,
    marginTop: Responsive.height(8),
    textAlign: 'center'
  },
  selectedEvidenceContainer: {
    marginTop: Responsive.height(16),
    flex: 1
  },
  evidenceSheetContainer: {
    padding: SPACING.sp20
  },
  evidenceSheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background.muted,
    borderRadius: BORDER_RADIUS.br12,
    padding: SPACING.sp16,
    marginBottom: SPACING.sp12
  },
  evidenceSheetButtonText: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.primary,
    marginLeft: SPACING.sp12
  },
  questionBox: {
    backgroundColor: '#F5F8FF',
    borderRadius: BORDER_RADIUS.br12,
    padding: SPACING.sp12,
    borderWidth: 1,
    borderColor: '#E2EEFF',
    marginTop: Responsive.height(8),
    marginBottom: Responsive.height(16)
  }
};

export default AssessmentParametersDetails;
