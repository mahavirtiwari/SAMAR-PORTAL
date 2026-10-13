import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../../assets/theme/Layout';
import { commonStyles } from '../../../assets/theme/Styles';
import { COLORS } from '../../../assets/theme/Theme';
import AppButton from '../../../components/base/AppButton';
import ImageUploaderUI from '../../../components/common/ImageUploaderUI';
import Header from '../../../components/layout/Header';
import ScreenWrapper from '../../../components/layout/ScreenWrapper';
import AppCommonModal from '../../../components/modals/AppCommonModal';
import ApplicationLoader from '../../../components/shared/Loader';
import Icons from '../../../constants/Icons';
import { getStepProgress } from '../../../redux/action/applicationAction';
import { getSitePictures } from '../../../redux/action/siteAction';
import { loadPendingCaptures } from '../../../services/offline/pendingCaptures';
import { recordSitePicture } from '../../../services/offline/recordSitePicture';
import { recordSitePictureDelete } from '../../../services/offline/recordSitePictureDelete';
import {
  cacheServerPictures,
  loadCachedPictures,
} from '../../../services/offline/sitePictureCache';
import { getToken } from '../../../services/storage/authStore';
import {
  acquireCaptureCoords,
  ensurePermission,
  getImagePickerOptions,
  Logger,
  prepareCapturedPhoto,
} from '../../../utils';

/**
 * SitePictures — capture the required Site Exterior & Site Interior photos,
 * geotag + watermark them, preview, and upload them against the assessment.
 *
 * Re-opening the screen rehydrates the already-uploaded pictures back into the
 * capture slots (served from each picture's protected `downloadUrl`). On Save
 * only the slots re-captured this session are uploaded — a replaced picture
 * deletes its server original first — so unchanged pictures are never
 * re-uploaded into the assessor's pool.
 */
const SitePictures = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { assessmentId, readOnly: readOnlyParam } = route.params || {};

  const [siteInteriorImage, setSiteInteriorImage] = useState(null);
  const [siteExteriorImage, setSiteExteriorImage] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [imageToDelete, setImageToDelete] = useState(null);
  const [hasServerPictures, setHasServerPictures] = useState(false);
  // Drives the loader across the offline-first save (enqueue + inline upload),
  // replacing the redux add/delete loading flags now that Save routes through
  // the outbox instead of the thunks.
  const [saving, setSaving] = useState(false);

  // Gate the capture UI until the first fetch of already-uploaded pictures
  // resolves, so re-opening an application never flashes empty capture tiles
  // (or the wrong "Save & Next" label) before the saved pictures rehydrate.
  // Starts loading only when there is an assessment to fetch for.
  const [initialLoading, setInitialLoading] = useState(!!assessmentId);

  // Auth header for the Image loader: the picture `downloadUrl` is a protected
  // API endpoint, and this app's AppFastImage has no auth layer, so the token
  // must ride along on the image request or it 401s and renders nothing.
  const [imageHeaders, setImageHeaders] = useState(null);

  // True only for a slot captured fresh in THIS session. A slot rehydrated from
  // the server keeps it false so Save skips re-uploading an unchanged picture.
  const [freshCapture, setFreshCapture] = useState({
    interior: false,
    exterior: false,
  });

  // A slot is "processing" from capture until its durable, geotagged file is
  // persisted. Save stays disabled meanwhile so it can never upload the volatile
  // camera-temp URI (which Android evicts, producing a blank server image).
  const [processing, setProcessing] = useState({
    interior: false,
    exterior: false,
  });

  // Server picture ids, so a replaced slot can delete its original before
  // uploading the new capture. Refs (not state) — never read during render.
  const originalInteriorPictureId = useRef(null);
  const originalExteriorPictureId = useRef(null);

  const { sitePicturesLoading } = useSelector(state => state.site);

  // The on-site unit admin and the enterprise admin can both capture, replace,
  // and delete site pictures. The screen renders read-only for any other role.
  const { userData } = useSelector(state => state.account);
  const canEdit = (userData?.user?.roles || []).some(
    role => role.slug === 'unit_admin' || role.slug === 'enterprise_admin',
  );
  // Also read-only once the lead has punched out: the step still opens so
  // submitted pictures stay viewable, but every capture/replace affordance is
  // withheld — an upload now would only be rejected server-side.
  // ApplicationDetail resolves that gate and passes it in.
  const readOnly = !canEdit || readOnlyParam === true;

  // Drive the global loader off the initial rehydrate and the site-picture
  // thunks — the initial GET of already-uploaded pictures plus the Save flow's
  // uploads and deletions. Covering initialLoading keeps the overlay up until
  // the saved pictures are in state, so the empty capture tiles never show.
  useEffect(() => {
    if (initialLoading || sitePicturesLoading || saving) {
      ApplicationLoader.show();
    } else {
      ApplicationLoader.hide();
    }
  }, [initialLoading, sitePicturesLoading, saving]);

  useEffect(() => {
    let active = true;
    (async () => {
      const token = await getToken('accessToken');
      if (active && token?.token) {
        setImageHeaders({ Authorization: `Bearer ${token.token}` });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!assessmentId) {
      return;
    }
    let active = true;
    (async () => {
      const hydrate = pictures => {
        setHasServerPictures(pictures.length > 0);
        pictures.forEach(picture => {
          const hasCoords = picture.latitude != null && picture.longitude != null;
          const value = {
            uri: picture.downloadUrl,
            pictureId: picture.id,
            coordinates: hasCoords
              ? {
                  latitude: parseFloat(picture.latitude),
                  longitude: parseFloat(picture.longitude),
                }
              : null,
            timestamp: picture.capturedAt,
            latitude: hasCoords ? parseFloat(picture.latitude) : null,
            longitude: hasCoords ? parseFloat(picture.longitude) : null,
            syncState: 'synced',
          };
          if (picture.title === 'Site Interior Picture') {
            originalInteriorPictureId.current = picture.id;
            setSiteInteriorImage(value);
          } else {
            originalExteriorPictureId.current = picture.id;
            setSiteExteriorImage(value);
          }
        });
      };

      // Overlay captures still queued in the outbox on top of whatever the GET
      // or the read-cache rehydrated. A queued offline capture is the newest,
      // not-yet-uploaded image for its slot, so it supersedes the server/cache
      // copy. It is left neither "fresh" (Save must not re-upload an already-
      // queued row) nor cleared of its original — the delete-then-add replace
      // path and cache invalidation on delete keep the slot consistent.
      const overlayPending = async () => {
        let pending = [];
        try {
          pending = await loadPendingCaptures({ assessmentId, kind: 'site' });
        } catch (err) {
          Logger.warn('Could not load pending site pictures:', err?.message || err);
          return;
        }
        if (!active || pending.length === 0) {
          return;
        }
        pending.forEach(cap => {
          const hasCoords = cap.latitude != null && cap.longitude != null;
          const value = {
            uri: cap.filePath,
            coordinates: hasCoords
              ? { latitude: parseFloat(cap.latitude), longitude: parseFloat(cap.longitude) }
              : null,
            timestamp: cap.capturedAt,
            latitude: hasCoords ? parseFloat(cap.latitude) : null,
            longitude: hasCoords ? parseFloat(cap.longitude) : null,
            syncState: cap.stuck ? 'failed' : 'pending',
          };
          if (cap.type === 'interior') {
            setSiteInteriorImage(value);
          } else {
            setSiteExteriorImage(value);
          }
        });
        setHasServerPictures(true);
      };

      try {
        const body = await dispatch(getSitePictures(assessmentId)).unwrap();
        const pictures = body?.data?.pictures || [];
        if (!active) {
          return;
        }
        // Render from the durable local cache, not the protected downloadUrl:
        // the native image loader renders the authenticated remote URL
        // unreliably (black tile), so mirror the offline path — write the
        // pictures through to the cache, then hydrate from the local file://
        // copies. Falls back to the remote url per-picture only when its
        // download was skipped or failed.
        const token = await getToken('accessToken');
        const authHeader = token?.token ? { Authorization: `Bearer ${token.token}` } : null;
        await cacheServerPictures({ assessmentId, kind: 'site', pictures, authHeader });
        if (!active) {
          return;
        }
        const cached = await loadCachedPictures({ assessmentId, kind: 'site' });
        const cachedById = new Map(cached.map(p => [String(p.id), p]));
        hydrate(pictures.map(p => cachedById.get(String(p.id)) || p));
      } catch (error) {
        // Offline (or the GET failed): fall back to the local read-cache so
        // previously-uploaded pictures still rehydrate into the slots.
        Logger.error('Could not load existing site pictures:', error);
        try {
          const cached = await loadCachedPictures({ assessmentId, kind: 'site' });
          if (active && cached.length > 0) {
            hydrate(cached);
          }
        } catch (cacheError) {
          Logger.warn('Could not load cached site pictures:', cacheError?.message || cacheError);
        }
      } finally {
        if (active) {
          await overlayPending();
          setInitialLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [assessmentId, dispatch]);

  const setImageForType = (type, value) => {
    if (type === 'interior') {
      setSiteInteriorImage(value);
    } else {
      setSiteExteriorImage(value);
    }
  };

  const stampAndSaveImage = async (imageAsset, type, coords) => {
    const { latitude, longitude } = coords;
    setProcessing(prev => ({ ...prev, [type]: true }));
    try {
      // Show the raw capture immediately for instant feedback, but do NOT mark
      // the slot uploadable yet — the durable, geotagged file doesn't exist
      // until prepareCapturedPhoto returns below, and Save must upload that, not
      // the soon-evicted camera temp.
      const timestamp = new Date().toISOString();
      setImageForType(type, {
        uri: imageAsset.uri,
        coordinates: { latitude, longitude },
        timestamp,
        latitude,
        longitude,
        syncState: 'pending',
      });

      const preparedUri = await prepareCapturedPhoto({
        uri: imageAsset.uri,
        assessmentId,
        bucket: 'site_pictures',
        latitude,
        longitude,
        timestamp,
        label: 'site picture',
      });
      // Durable file in hand: stage it and only now mark the slot fresh, so Save
      // uploads this persisted URI rather than the volatile capture temp.
      setImageForType(type, {
        uri: preparedUri,
        coordinates: { latitude, longitude },
        timestamp,
        latitude,
        longitude,
        syncState: 'pending',
      });
      setFreshCapture(prev => ({ ...prev, [type]: true }));
    } catch (error) {
      Logger.error('Error in stampAndSaveImage:', error);
      // Capture/persist failed (empty file) — clear the slot and ask for a
      // retake rather than staging a doomed raw uri.
      setImageForType(type, null);
      setFreshCapture(prev => ({ ...prev, [type]: false }));
      const message = typeof error === 'string' ? error : error?.message;
      Alert.alert('Capture Failed', message || 'Could not save the picture. Please retake it.');
    } finally {
      setProcessing(prev => ({ ...prev, [type]: false }));
    }
  };

  const openImagePicker = async type => {
    const cameraGranted = await ensurePermission('camera');
    if (!cameraGranted) {
      return;
    }

    // Site photos are geo-verification evidence: obtain a valid fix BEFORE the
    // camera opens and block the capture entirely if none is available, so a
    // coordinate-less picture can never be taken. acquireCaptureCoords shows a
    // single "Location Required" message and returns null on failure.
    ApplicationLoader.show();
    const coords = await acquireCaptureCoords();
    ApplicationLoader.hide();
    if (!coords) {
      return;
    }

    const options = getImagePickerOptions({
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.8,
    });
    launchCamera(options, response => {
      if (response.didCancel || response.errorCode) {
        Logger.warn('Camera capture cancelled or error');
      } else if (response.assets && response.assets[0]) {
        stampAndSaveImage(response.assets[0], type, coords);
      }
    });
  };

  const handleSaveAndNext = async () => {
    if (!siteInteriorImage || !siteExteriorImage) {
      Logger.warn('Both site pictures are required before saving.');
      return;
    }

    if (!assessmentId) {
      Logger.error('Missing assessmentId, cannot upload site pictures.');
      Alert.alert('Upload Failed', 'Assessment details are unavailable. Please try again later.');
      return;
    }

    setSaving(true);
    try {
      // Offline-first: each re-captured slot is queued to the outbox and, when
      // online, uploaded inline; offline it stays queued and auto-syncs on
      // reconnect. A replaced slot deletes its server original first (queued
      // before the new capture so the drain replays them in order). Deletes and
      // uploads are awaited sequentially to preserve that FIFO order.
      if (freshCapture.exterior) {
        if (originalExteriorPictureId.current) {
          await recordSitePictureDelete({
            serverAssessmentId: assessmentId,
            pictureId: originalExteriorPictureId.current,
          });
          originalExteriorPictureId.current = null;
        }
        await recordSitePicture({
          serverAssessmentId: assessmentId,
          type: 'exterior',
          uri: siteExteriorImage.uri,
          latitude: siteExteriorImage.latitude,
          longitude: siteExteriorImage.longitude,
          capturedAt: siteExteriorImage.timestamp,
        });
      }

      if (freshCapture.interior) {
        if (originalInteriorPictureId.current) {
          await recordSitePictureDelete({
            serverAssessmentId: assessmentId,
            pictureId: originalInteriorPictureId.current,
          });
          originalInteriorPictureId.current = null;
        }
        await recordSitePicture({
          serverAssessmentId: assessmentId,
          type: 'interior',
          uri: siteInteriorImage.uri,
          latitude: siteInteriorImage.latitude,
          longitude: siteInteriorImage.longitude,
          capturedAt: siteInteriorImage.timestamp,
        });
      }

      // Refresh step progress so the detail screen reflects site_pictures as
      // completed when the user returns. Best-effort: offline it no-ops, the
      // captures are already safely queued.
      await dispatch(getStepProgress(assessmentId));

      setSuccessModal(true);
      setTimeout(() => {
        setSuccessModal(false);
        navigation.goBack();
      }, 2000);
    } catch (error) {
      Logger.error('Error saving site pictures:', error);
      // record* only throws on an unrecoverable capture (empty/missing file) —
      // network problems are absorbed into the outbox — so ask for a retake.
      const message = typeof error === 'string' ? error : error?.message;
      Alert.alert(
        'Save Failed',
        message || 'Could not save your site pictures. Please retake and try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const renderPictureSection = (title, imageData, type) => {
    // Read-only viewer (enterprise admin) with nothing uploaded yet: show a
    // plain placeholder instead of the capture tile so it can't launch the camera.
    if (readOnly && !imageData?.uri) {
      return (
        <View style={{ marginBottom: Responsive.height(20) }}>
          <Text style={[commonStyles.h2heading600, { marginBottom: Responsive.height(8) }]}>
            {title}
          </Text>
          <Text style={{ color: COLORS.text.heading, opacity: 0.6 }}>Not uploaded yet</Text>
        </View>
      );
    }

    return (
      <ImageUploaderUI
        title={title}
        image={imageData?.uri}
        imageHeaders={imageHeaders}
        coordinates={imageData?.coordinates}
        timestamp={imageData?.timestamp}
        syncState={imageData?.syncState}
        onPress={readOnly ? undefined : () => openImagePicker(type)}
        onEdit={!readOnly && imageData ? () => openImagePicker(type) : undefined}
        style={{ marginBottom: Responsive.height(20) }}
      />
    );
  };

  // A freshly captured slot must carry coordinates; rehydrated server slots are
  // skipped by Save so they're exempt. Belt-and-suspenders behind the capture
  // gate — a coordinate-less picture must never unlock the next step.
  const freshSlotReady = (image, isFresh) =>
    !isFresh || (Number.isFinite(image?.latitude) && Number.isFinite(image?.longitude));

  // Enabled only once both pictures are present, something changed this session
  // (so a returning user can't re-submit an unchanged set), every fresh slot is
  // geotagged, and no slot is still processing — so Save can never upload a
  // not-yet-durable capture temp.
  const primaryButtonEnabled =
    !!siteInteriorImage &&
    !!siteExteriorImage &&
    !processing.interior &&
    !processing.exterior &&
    (freshCapture.interior || freshCapture.exterior) &&
    freshSlotReady(siteInteriorImage, freshCapture.interior) &&
    freshSlotReady(siteExteriorImage, freshCapture.exterior);
  const primaryButtonLabel = hasServerPictures ? 'Update' : 'Save & Next';

  return (
    <View style={[commonStyles.fill, commonStyles.backgroundColor]}>
      <Header title="Site Pictures" back={true} syncStatus={true} />
      <ScreenWrapper scrollable={true} showLogo={false}>
        {initialLoading ? null : (
          <View
            style={{
              backgroundColor: COLORS.background.primary,
              paddingHorizontal: Responsive.width(16),
              paddingTop: Responsive.height(16),
            }}>
            {renderPictureSection('Site Exterior Picture', siteExteriorImage, 'exterior')}
            <View
              style={{
                height: Responsive.height(1),
                backgroundColor: COLORS.border.light,
                marginBottom: Responsive.height(20),
              }}
            />
            {renderPictureSection('Site Interior Picture', siteInteriorImage, 'interior')}
          </View>
        )}
      </ScreenWrapper>
      <AppCommonModal
        showmodal={modalOpen}
        imgsrc={Icons.deleteIcon}
        LeftbuttonTextColor={COLORS.button.primary}
        leftButtonColor={'#E2EEFF'}
        title="Delete Picture"
        subTitle="Are you sure want to delete Picture?"
        twoButtonModal={true}
        leftButtonText="Cancel"
        LeftonPress={() => {
          setModalOpen(false);
          setImageToDelete(null);
        }}
        rightButtonText="Delete"
        onPress={() => {
          setImageForType(imageToDelete, null);
          setModalOpen(false);
          setImageToDelete(null);
        }}
        leftvariant="secondary"
        variant="danger"
      />
      <AppCommonModal
        showmodal={successModal}
        imgsrc={Icons.success}
        title="Site Picture Added"
        subTitle="Your site picture has been added successfully."
      />
      {!initialLoading && !readOnly && (
        <View
          style={{
            paddingHorizontal: Responsive.width(16),
            paddingVertical: Responsive.height(16),
            backgroundColor: COLORS.background.primary,
          }}>
          <AppButton
            disabled={!primaryButtonEnabled}
            title={primaryButtonLabel}
            variant="primary"
            size="large"
            onPress={handleSaveAndNext}
          />
        </View>
      )}
    </View>
  );
};

export default SitePictures;
