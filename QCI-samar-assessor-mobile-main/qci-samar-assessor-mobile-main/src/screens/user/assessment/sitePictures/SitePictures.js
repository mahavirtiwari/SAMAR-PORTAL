import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { COLORS } from '../../../../assets/theme/Theme';
import { AppButton } from '../../../../components';
import AppEmptyState from '../../../../components/base/AppEmptyState';
import ImageUploaderUI from '../../../../components/common/ImageUploaderUI';
import { Header, ScreenWrapper } from '../../../../components/layout';
import { AppCommonModal } from '../../../../components/modals';
import ApplicationLoader from '../../../../components/shared/Loader';
import Icons from '../../../../constants/Icons';
import Images from '../../../../constants/Images';
import {
  getAssessmentByIdAction,
  getStepProgressAction
} from '../../../../redux/action/assessmentAction';
import {
  addSitePictureAction,
  deleteSitePictureAction,
  getMySitePicturesAction,
  getSitePicturePoolAction
} from '../../../../redux/action/siteAction';
import { resetSitePictureState } from '../../../../redux/slices/siteSlice';
import { persistCapture, stampCapture } from '../../../../services/offline/capturePipeline';
import { getImagePickerOptions, isInitialLoad, Logger } from '../../../../utils';
import { acquireCaptureCoords } from '../../../../utils/location';
import { ensurePermission } from '../../../../utils/permissions';
import { showWarningToast } from '../../../../utils/toast';

const SitePictures = ({ route }) => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const {
    assessmentId,
    assessmentData: routeAssessmentData,
    readOnly = false
  } = route.params || {};
  const [siteInteriorImage, setSiteInteriorImage] = useState(null);
  const [siteExteriorImage, setSiteExteriorImage] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [imageToDelete, setImageToDelete] = useState(null);
  const [pictureIdToDelete, setPictureIdToDelete] = useState(null);
  const [deletedPictureIds, setDeletedPictureIds] = useState([]);

  // Track original picture IDs from API so we can delete them when replaced
  const originalInteriorPictureId = useRef(null);
  const originalExteriorPictureId = useRef(null);

  // True only for a slot captured fresh in THIS session. A picture rehydrated
  // from the local mirror (an already-queued offline capture) also surfaces a
  // file:// path, so the old "is it a server URL?" check misread it as new and
  // ran delete-old-then-re-add against the SAME file — unlinking the durable
  // image its own pending outbox row still pointed at (terminal "needs
  // re-capture" at sync). Only a fresh capture may be uploaded/replaced.
  const [freshCapture, setFreshCapture] = useState({ interior: false, exterior: false });
  // False for a slot holding another team member's picture: it is shown but
  // must not be retaken, because the retake path queues a DELETE the server
  // refuses (403) and the row would sit in the stuck list.
  const [replaceable, setReplaceable] = useState({ interior: true, exterior: true });

  // Service-sector: the applicant uploads the site pictures (no assessor camera
  // capture) and that upload completes the step; the assessor views them
  // read-only. Prefer the assessment passed on navigation, fall back to the slice.
  const { assessmentData } = useSelector((state) => state.assessment);
  const { userData } = useSelector((state) => state.account);
  const sector = (routeAssessmentData || assessmentData)?.assessment?.application?.sector;
  const isServiceSector = String(sector || '').toLowerCase() === 'service';

  const [refreshing, setRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Mirrors isSaving for reads inside effects without re-subscribing them.
  const isSavingRef = useRef(false);

  useEffect(() => {
    dispatch(resetSitePictureState());
    if (isServiceSector) {
      dispatch(getSitePicturePoolAction(assessmentId));
    } else {
      dispatch(getMySitePicturesAction(assessmentId));
    }
  }, [assessmentId, dispatch, isServiceSector]);

  const {
    mySitePictures,
    mySitePicturesLoading,
    mySitePicturesError,
    deleteSitePictureLoading,
    deleteSitePictureData,
    addSitePictureLoading,
    sitePictures,
    sitePictureLoading
  } = useSelector((state) => state.site);

  useEffect(() => {
    if (
      deleteSitePictureLoading ||
      mySitePicturesLoading ||
      addSitePictureLoading ||
      sitePictureLoading
    ) {
      ApplicationLoader.show('sitePictures');
    } else {
      ApplicationLoader.hide('sitePictures');
    }
  }, [deleteSitePictureLoading, mySitePicturesLoading, addSitePictureLoading, sitePictureLoading]);

  useEffect(() => {
    if (deleteSitePictureData) {
      dispatch(getMySitePicturesAction(assessmentId));
      dispatch(getStepProgressAction(assessmentId));
    }
  }, [deleteSitePictureData, assessmentId, dispatch]);

  useEffect(() => {
    // Never let a mid-save server re-fetch clobber the freshly captured
    // previews. The delete-driven re-fetch (above) can resolve before the new
    // upload is reflected server-side, briefly returning the OLD picture; if it
    // re-hydrated the slots here, the preview would flip old → new (the
    // flicker). The screen navigates back after a successful save, so the
    // authoritative reload happens on the next visit.
    if (isSavingRef.current) {
      return;
    }
    if (mySitePictures?.pictures?.length > 0) {
      mySitePictures?.pictures?.forEach((picture) => {
        Logger.info('Processing picture:', picture);
        // Only a picture this user uploaded may be replaced. The /mine endpoint
        // and the local table are both owner-scoped today, so this is a guard
        // against a future data path handing this screen a teammate's picture:
        // a retake would queue a DELETE the server refuses with 403. A local row
        // is always this user's own capture; a server row names its uploader.
        // An unknown current user (profile not loaded yet) must not read as
        // "someone else": that would upload a duplicate instead of replacing.
        const currentUserId = userData?.user?.id;
        const uploaderId = picture.teamMember?.user?.id ?? picture.uploadedByUser?.id;
        const ownsPicture =
          picture.localId != null ||
          uploaderId == null ||
          currentUserId == null ||
          uploaderId === currentUserId;
        if (!ownsPicture) {
          Logger.warn(
            `Site picture ${picture.id} belongs to another team member: shown, not replaceable`
          );
        }
        if (picture.title === 'Site Interior Picture') {
          originalInteriorPictureId.current = ownsPicture ? picture.id : null;
          setReplaceable((prev) => ({ ...prev, interior: ownsPicture }));
          setFreshCapture((prev) => ({ ...prev, interior: false }));
          setSiteInteriorImage({
            uri: picture.downloadUrl,
            pictureId: picture.id,
            coordinates:
              picture.latitude && picture.longitude
                ? {
                    latitude: parseFloat(picture.latitude),
                    longitude: parseFloat(picture.longitude)
                  }
                : null,
            timestamp: picture.capturedAt,
            latitude: parseFloat(picture.latitude),
            longitude: parseFloat(picture.longitude),
            syncState: picture.syncState || 'synced'
          });
        } else if (picture.title === 'Site Exterior Picture') {
          originalExteriorPictureId.current = ownsPicture ? picture.id : null;
          setReplaceable((prev) => ({ ...prev, exterior: ownsPicture }));
          setFreshCapture((prev) => ({ ...prev, exterior: false }));
          setSiteExteriorImage({
            uri: picture.downloadUrl,
            pictureId: picture.id,
            coordinates:
              picture.latitude && picture.longitude
                ? {
                    latitude: parseFloat(picture.latitude),
                    longitude: parseFloat(picture.longitude)
                  }
                : null,
            timestamp: picture.capturedAt,
            latitude: parseFloat(picture.latitude),
            longitude: parseFloat(picture.longitude),
            syncState: picture.syncState || 'synced'
          });
        }
      });
    }
  }, [mySitePictures, userData?.user?.id]);
  const fetchLocationAndSaveImage = async (imageAsset, type, coords) => {
    // Optimistic instant preview off the raw camera temp. It's swapped for the
    // durable copy below BEFORE stamping runs, so the preview never stays
    // pinned to the soon-evicted temp (BUG-05611). Coordinates are already
    // resolved by the capture gate (acquireCaptureCoords) before the camera
    // opened, so they're valid from the first frame.
    const timestamp = new Date().toISOString();
    const setSlot = type === 'interior' ? setSiteInteriorImage : setSiteExteriorImage;
    setSlot({
      uri: imageAsset.uri,
      coordinates: { latitude: coords.latitude, longitude: coords.longitude },
      timestamp,
      latitude: coords.latitude,
      longitude: coords.longitude,
      syncState: 'pending'
    });

    try {
      // 1. Persist to durable storage — the image now survives reopen and
      //    eviction.
      const durableUri = await persistCapture({
        uri: imageAsset.uri,
        serverAssessmentId: assessmentId,
        bucket: 'site_pictures',
        label: 'site picture'
      });
      setSlot({
        uri: durableUri,
        coordinates: { latitude: coords.latitude, longitude: coords.longitude },
        timestamp,
        latitude: coords.latitude,
        longitude: coords.longitude
      });
      setFreshCapture((prev) => ({ ...prev, [type]: true }));

      // 2. Burn the stamp onto the durable file and swap in the stamped copy.
      const stampedUri = await stampCapture({
        uri: durableUri,
        serverAssessmentId: assessmentId,
        bucket: 'site_pictures',
        latitude: coords.latitude,
        longitude: coords.longitude,
        timestamp,
        label: 'site picture'
      });

      const imageObject = {
        uri: stampedUri,
        coordinates: { latitude: coords.latitude, longitude: coords.longitude },
        timestamp,
        latitude: coords.latitude,
        longitude: coords.longitude,
        syncState: 'pending'
      };
      setSlot(imageObject);
      Logger.info(`${type} image saved with coordinates:`, imageObject);
    } catch (error) {
      Logger.error('Error in fetchLocationAndSaveImage:', error);
      // Capture/persist failed (empty file) — clear the slot and ask for a
      // retake rather than staging a doomed raw uri.
      if (type === 'interior') {
        setSiteInteriorImage(null);
      } else {
        setSiteExteriorImage(null);
      }
      setFreshCapture((prev) => ({ ...prev, [type]: false }));
      const message = typeof error === 'string' ? error : error?.message;
      showWarningToast(
        'Capture Failed',
        message || 'Could not save the picture. Please retake it.'
      );
    }
  };

  const openImagePicker = (type) => {
    openCamera(type);
  };

  const openCamera = async (type) => {
    const cameraGranted = await ensurePermission('camera');
    if (!cameraGranted) {
      return;
    }

    // Site photos are geo-verification evidence: obtain a valid fix BEFORE the
    // camera opens and block the capture entirely if none is available, so a
    // coordinate-less picture can never be taken. acquireCaptureCoords shows a
    // single "Location Required" alert and returns null on failure.
    ApplicationLoader.show('sitePicturesCapture');
    const coords = await acquireCaptureCoords();
    ApplicationLoader.hide('sitePicturesCapture');
    if (!coords) {
      return;
    }

    const options = getImagePickerOptions({
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.8
    });

    launchCamera(options, (response) => {
      if (response.didCancel || response.error) {
        Logger.warn('Camera cancelled or error');
      } else if (response.assets && response.assets[0]) {
        fetchLocationAndSaveImage(response.assets[0], type, coords);
      }
    });
  };

  const handleSaveAndNext = async () => {
    if (isSaving) {
      return;
    }
    if (!siteInteriorImage && !siteExteriorImage) {
      Logger.warn('Missing Images', 'Please capture at least one picture before proceeding.');
      return;
    }

    setIsSaving(true);
    isSavingRef.current = true;
    try {
      // Upload/replace only slots captured fresh this session. A rehydrated
      // existing picture (server- or local-sourced) must NOT be re-added —
      // doing so deletes its durable file and re-queues a missing one.
      if (siteInteriorImage && freshCapture.interior) {
        // Replacing an existing picture — remove it first. Its file differs
        // from the fresh capture, so this never touches the new image.
        if (originalInteriorPictureId.current) {
          await dispatch(
            deleteSitePictureAction({
              assessmentId,
              pictureId: originalInteriorPictureId.current
            })
          ).unwrap();
          originalInteriorPictureId.current = null;
        }
        await dispatch(
          addSitePictureAction({
            assessmentId,
            type: 'interior',
            uri: siteInteriorImage.uri,
            latitude: siteInteriorImage.latitude,
            longitude: siteInteriorImage.longitude
          })
        ).unwrap();
        Logger.info('Interior picture captured');
      }

      if (siteExteriorImage && freshCapture.exterior) {
        if (originalExteriorPictureId.current) {
          await dispatch(
            deleteSitePictureAction({
              assessmentId,
              pictureId: originalExteriorPictureId.current
            })
          ).unwrap();
          originalExteriorPictureId.current = null;
        }
        await dispatch(
          addSitePictureAction({
            assessmentId,
            type: 'exterior',
            uri: siteExteriorImage.uri,
            latitude: siteExteriorImage.latitude,
            longitude: siteExteriorImage.longitude
          })
        ).unwrap();
        Logger.info('Exterior picture captured');
      }

      // Process any deletions marked locally by the user
      if (deletedPictureIds && deletedPictureIds.length > 0) {
        for (const picId of Array.from(new Set(deletedPictureIds))) {
          try {
            await dispatch(
              deleteSitePictureAction({
                assessmentId,
                pictureId: picId
              })
            ).unwrap();
            Logger.info('Deleted marked picture:', picId);
          } catch (err) {
            Logger.error('Failed to delete marked picture:', picId, err);
          }
        }
        // clear deletions after attempting
        setDeletedPictureIds([]);
      }

      // Saved slots are no longer fresh — a second tap (the button stays live
      // during the 2s success window) must not re-upload and create a duplicate
      // pair. Both upload branches above are gated on freshCapture.
      setFreshCapture({ interior: false, exterior: false });

      // Open modal after successful upload, then auto-close and navigate after 2 seconds
      setSuccessModal(true);

      setTimeout(async () => {
        if (!navigation.isFocused()) {
          return;
        }
        await dispatch(getAssessmentByIdAction(assessmentId));
        await dispatch(getStepProgressAction(assessmentId));
        setSuccessModal(false);

        navigation.goBack();
      }, 2000);
    } catch (error) {
      Logger.error('Error uploading site pictures:', error);
      // persistPhoto can reject with a "please retake" message when the capture
      // produced an empty/missing file — surface it instead of silently doing
      // nothing, so the assessor knows to recapture rather than leaving a gap.
      // The thunk rejects via rejectWithValue(error.message), so unwrap() throws
      // the string payload, not an Error.
      const message = typeof error === 'string' ? error : error?.message;
      showWarningToast(
        'Save Failed',
        message || 'Could not save the site pictures. Please try again.'
      );
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  };

  const onRefreshPool = async () => {
    setRefreshing(true);
    await dispatch(getSitePicturePoolAction(assessmentId));
    setRefreshing(false);
  };

  // Service-sector display screen: show applicant-uploaded pictures in read-only mode.
  if (isServiceSector) {
    // Newest-first by capture time so the most recently picked photo sits on top.
    // Tie-break on id so equal/unparseable timestamps keep a deterministic order.
    const pool = [...(sitePictures?.pictures || [])].sort((a, b) => {
      const ta = new Date(a.capturedAt).getTime();
      const tb = new Date(b.capturedAt).getTime();
      if (tb !== ta && !Number.isNaN(ta) && !Number.isNaN(tb)) {
        return tb - ta;
      }
      return Number(b.id) - Number(a.id);
    });
    return (
      <View style={[commonStyles.fill, commonStyles.backgroundColor]}>
        <Header title="Site Pictures" back={true} />
        <View style={[commonStyles.fill]}>
          {pool.length === 0 ? (
            <AppEmptyState
              EmptyImage={Images.emptyStateGateImage}
              heading="No Site Pictures Yet"
              subHeading="The applicant has not uploaded any site pictures yet."
            />
          ) : (
            <FlatList
              data={pool}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <ImageUploaderUI
                  title={item.title}
                  image={item.downloadUrl}
                  coordinates={
                    item.latitude && item.longitude
                      ? {
                          latitude: parseFloat(item.latitude),
                          longitude: parseFloat(item.longitude)
                        }
                      : item.coordinates
                  }
                  timestamp={item.capturedAt}
                  syncState="synced"
                  style={{
                    marginVertical: Responsive.height(16),
                    paddingHorizontal: Responsive.width(16)
                  }}
                />
              )}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshPool} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Responsive.height(20) }}
              ItemSeparatorComponent={() => <View style={styles.photoSeparator} />}
            />
          )}
        </View>
      </View>
    );
  }

  // Hold a loader over the capture slots until the saved pictures have been
  // fetched, so a returning user never sees the empty "capture" placeholders
  // flash before their existing photos hydrate in.
  if (isInitialLoad(mySitePicturesLoading, mySitePictures, mySitePicturesError)) {
    return (
      <View style={[commonStyles.fill, commonStyles.backgroundColor]}>
        <Header title="Site Pictures" back={true} />
      </View>
    );
  }

  // readOnly is the post-punch-out review pass: the captures stay visible (and
  // tappable for the full-screen preview inside ImageUploaderUI) while every
  // capture/replace affordance is withheld. Omitting the handlers is what hides
  // them — ImageUploaderUI renders the edit and delete buttons only when the
  // matching callback is supplied.
  const renderPictureSection = (title, imageData, onPress, type) => {
    return (
      <ImageUploaderUI
        title={title}
        image={imageData?.uri}
        coordinates={imageData?.coordinates}
        timestamp={imageData?.timestamp}
        syncState={imageData?.syncState}
        onPress={readOnly ? undefined : onPress}
        onEdit={readOnly || !replaceable[type] ? undefined : () => openImagePicker(type)}
        style={{ marginBottom: Responsive.height(20) }}
      />
    );
  };

  // Compute whether images are from API or newly selected, and set label/enablement.
  // API images are remote (https), newly picked ones are local (file:// or content://) —
  // scheme is the discriminator, never the API hostname (hosts change per environment).
  const isInteriorFromAPI = /^https?:\/\//.test(siteInteriorImage?.uri ?? '');
  const isExteriorFromAPI = /^https?:\/\//.test(siteExteriorImage?.uri ?? '');

  const hasNewInterior = siteInteriorImage && !isInteriorFromAPI;
  const hasNewExterior = siteExteriorImage && !isExteriorFromAPI;

  // 'Update' vs 'Save & Next' — a returning user already has both pictures on
  // the mirror. Derived from the loaded list (render-safe) rather than the
  // delete-tracking refs, which must not be read during render.
  const hadBothFromAPI =
    !!mySitePictures?.pictures?.some((p) => p.title === 'Site Interior Picture') &&
    !!mySitePictures?.pictures?.some((p) => p.title === 'Site Exterior Picture');
  // Any local change: newly selected images or marked deletions
  const hasAnyChange =
    hasNewInterior || hasNewExterior || (deletedPictureIds && deletedPictureIds.length > 0);

  // Button enabled only when both images are present and the user has made a change
  const primaryButtonEnabled = !!siteInteriorImage && !!siteExteriorImage && hasAnyChange;

  // Label: show 'Update' only when API images originally existed (user returning),
  // otherwise show 'Save & Next' for initial save flow
  const primaryButtonLabel = hadBothFromAPI ? 'Update' : 'Save & Next';

  return (
    <View style={[commonStyles.fill, commonStyles.backgroundColor]}>
      <Header title="Site Pictures" back={true} />
      <ScreenWrapper scrollable={true} showLogo={false}>
        {/* Site Interior Picture Section */}
        <View
          style={{
            backgroundColor: COLORS.background.primary,
            paddingHorizontal: Responsive.width(16),
            paddingTop: Responsive.height(16)
          }}>
          {/* Site Exterior Picture Section */}
          {renderPictureSection(
            'Site Exterior Picture',
            siteExteriorImage,
            () => openImagePicker('exterior'),
            'exterior'
          )}
          <View
            style={{
              height: Responsive.height(1),
              backgroundColor: COLORS.border.light,
              marginBottom: Responsive.height(20)
            }}
          />
          {renderPictureSection(
            'Site Interior Picture',
            siteInteriorImage,
            () => openImagePicker('interior'),
            'interior'
          )}
        </View>
        {/* Save & Next Button */}
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
          setPictureIdToDelete(null);
        }}
        rightButtonText="Delete"
        onPress={async () => {
          // Local-first delete: mark API pictures for deletion later, and remove local preview now
          if (pictureIdToDelete) {
            setDeletedPictureIds((prev) => [...prev, pictureIdToDelete]);
          }
          if (imageToDelete === 'interior') {
            setSiteInteriorImage(null);
          } else {
            setSiteExteriorImage(null);
          }
          setModalOpen(false);
          setImageToDelete(null);
          setPictureIdToDelete(null);
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
      {readOnly ? null : (
        <View
          style={{
            paddingHorizontal: Responsive.width(16),
            paddingVertical: Responsive.height(16),
            backgroundColor: COLORS.background.primary
          }}>
          <AppButton
            disabled={!primaryButtonEnabled || isSaving}
            title={primaryButtonLabel}
            variant="primary"
            size="large"
            loader={isSaving}
            onPress={handleSaveAndNext}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  photoSeparator: {
    height: 1,
    backgroundColor: '#EBEDF3',
    marginTop: Responsive.height(12),
    marginHorizontal: Responsive.width(16)
  }
});

export default SitePictures;
