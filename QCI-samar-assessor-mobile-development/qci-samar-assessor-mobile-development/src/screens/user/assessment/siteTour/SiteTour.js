import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../../../assets/theme/Theme';
import { AppButton } from '../../../../components';
import SiteTourImage from '../../../../components/assessment/SiteTourImage';
import AppEmptyState from '../../../../components/base/AppEmptyState';
import AppInput from '../../../../components/base/textInput/AppInput';
import ImageUploaderUI from '../../../../components/common/ImageUploaderUI';
import { Header } from '../../../../components/layout';
import { AppCommonModal } from '../../../../components/modals';
import { AppBottomSheet } from '../../../../components/shared';
import ApplicationLoader from '../../../../components/shared/Loader';
import ScreenLoader from '../../../../components/shared/ScreenLoader';
import Icons from '../../../../constants/Icons';
import Images from '../../../../constants/Images';
import {
  getAssessmentByIdAction,
  getStepProgressAction
} from '../../../../redux/action/assessmentAction';
import {
  addSiteTourPictureAction,
  deleteSiteTourPictureAction,
  getSiteTourPicturePoolAction,
  getSiteTourPicturesAction
} from '../../../../redux/action/siteAction';
import {
  resetAddSiteTourPictureState,
  resetDeleteSiteTourPictureState,
  resetSiteTourPicturesState
} from '../../../../redux/slices/siteSlice';
import { persistCapture, stampCapture } from '../../../../services/offline/capturePipeline';
import {
  getImagePickerOptions,
  isInitialLoad,
  Logger,
  shouldShowApplicationLoader
} from '../../../../utils';
import { acquireCaptureCoords } from '../../../../utils/location';
import { ensurePermission } from '../../../../utils/permissions';
import { showWarningToast } from '../../../../utils/toast';

const SiteTour = ({ route }) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  // readOnly is the post-punch-out review pass: the captured tour is browsable,
  // but nothing can be added, replaced or deleted and no save is offered.
  const {
    assessmentId,
    assessmentData: routeAssessmentData,
    readOnly = false
  } = route.params || {};
  const refRBSheet = useRef(null);
  const [siteImages, setSiteImages] = useState([]);
  const [pictureTitle, setPictureTitle] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  // Lat/long + timestamp captured at the moment the photo is shot, kept until
  // the user titles and uploads it. The image is already stamped by then.
  const [capturedMeta, setCapturedMeta] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState(null);
  const [successModal, setSuccessModal] = useState(false);
  const [deletedPictureIds, setDeletedPictureIds] = useState([]);
  const [saveImageDisabled, setSaveImageDisabled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const { assessmentData } = useSelector((state) => state.assessment);

  // Service-sector assessments are conducted online (meeting link). The
  // applicant uploads the site-tour photos (no assessor camera capture) and that
  // upload completes the step; the assessor views them read-only. Prefer the
  // assessment passed on navigation, fall back to the slice (the parent keeps it fresh).
  const sector = (routeAssessmentData || assessmentData)?.assessment?.application?.sector;
  const isServiceSector = String(sector || '').toLowerCase() === 'service';

  useEffect(() => {
    dispatch(resetSiteTourPicturesState());
    if (isServiceSector) {
      dispatch(getSiteTourPicturePoolAction(assessmentId));
    } else {
      dispatch(getSiteTourPicturesAction(assessmentId));
    }
  }, [isServiceSector]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (isServiceSector) {
      await dispatch(getSiteTourPicturePoolAction(assessmentId));
    } else {
      await dispatch(getSiteTourPicturesAction(assessmentId));
    }
    setRefreshing(false);
  };

  const { siteTourPictures, siteTourPicturesError } = useSelector((state) => state.site);

  const { deleteSiteTourPictureData, siteTourPicturesLoading } = useSelector((state) => state.site);

  const showInitialLoader = isInitialLoad(
    siteTourPicturesLoading,
    siteTourPictures,
    siteTourPicturesError
  );
  const { userData } = useSelector((state) => state.account);

  useEffect(() => {
    // During Save the per-photo add/delete flags flip on and off once per image,
    // which flashed the global loader repeatedly. Hold one steady loader for the
    // whole save instead (until the success modal takes over), and outside a
    // save only the list refetch counts as busy.
    const isPictureBusy = isSaving ? !successModal : siteTourPicturesLoading;
    if (shouldShowApplicationLoader({ showInitialLoader, isBusy: isPictureBusy })) {
      ApplicationLoader.show('siteTour');
    } else {
      ApplicationLoader.hide('siteTour');
    }

    // The delete-driven refetch below deliberately does not run during the
    // first load: there is nothing on screen yet to refresh, and re-entering
    // the fetch while it is still in flight re-triggers this same effect.
    if (showInitialLoader) {
      return;
    }

    if (deleteSiteTourPictureData) {
      dispatch(getSiteTourPicturesAction(assessmentId));
      dispatch(resetAddSiteTourPictureState());
      dispatch(resetDeleteSiteTourPictureState());
    }
  }, [
    showInitialLoader,
    isSaving,
    successModal,
    siteTourPicturesLoading,
    deleteSiteTourPictureData,
    assessmentId,
    dispatch
  ]);

  const siteTourImageDelete = async (id) => {
    // Find the image and remove locally
    const imageToDeleteFromState = siteImages.find((img) => img.id === id);
    setSiteImages((prev) => prev.filter((img) => img.id !== id));
    setModalOpen(false);
    setImageToDelete(null);
    // Mark API images for deletion to be processed on Save
    if (imageToDeleteFromState && imageToDeleteFromState.isFromAPI) {
      setDeletedPictureIds((prev) => [...prev, id]);
    }
  };
  useEffect(() => {
    // Service uses the selection grid, not the capture list — skip the merge
    // (the pool rows have no teamMember, which this mapping dereferences).
    if (isServiceSector) {
      return;
    }
    if (siteTourPictures?.pictures?.length > 0) {
      const formattedPictures = siteTourPictures?.pictures
        ?.filter((picture) => !deletedPictureIds.includes(picture.id))
        ?.map((picture) => ({
          id: picture.id,
          uri: picture.downloadUrl,
          title: picture.title,
          coordinates: `${parseFloat(picture.latitude).toFixed(6)}, ${parseFloat(
            picture.longitude
          ).toFixed(6)}`,
          timestamp: new Date(picture.capturedAt),
          latitude: parseFloat(picture.latitude),
          longitude: parseFloat(picture.longitude),
          isFromAPI: true,
          type: 'image/jpeg',
          name: picture.fileName || 'site_tour_image.jpg',
          user: picture.teamMember.user
            ? `${picture.teamMember.user.firstName} ${picture.teamMember.user.lastName}`
            : 'Unknown',
          teamMemberId: picture.teamMember?.user?.id,
          syncState: picture.syncState || 'synced'
        }));
      // Keep local images that are not yet on the server. Once a just-uploaded
      // photo reappears in the refetched server list (same title + coordinates),
      // drop its local copy so it isn't listed twice — the delete-then-add-then-
      // save +1. Offline-pending photos have no server twin yet, so they stay.
      const localImages = siteImages.filter((img) => {
        if (img.isFromAPI) {
          return false;
        }
        const hasServerTwin = formattedPictures.some(
          (p) => p.title === img.title && p.coordinates === img.coordinates
        );
        return !hasServerTwin;
      });
      // Merge API images and local images
      const mergedImages = [...formattedPictures, ...localImages];
      // Only update state if data actually changed
      const isSame =
        mergedImages.length === siteImages.length &&
        mergedImages.every((pic, idx) => {
          const s = siteImages[idx];
          return (
            s &&
            s.id === pic.id &&
            s.uri === pic.uri &&
            s.title === pic.title &&
            s.coordinates === pic.coordinates
          );
        });
      if (!isSame) {
        setSiteImages(mergedImages);
        Logger.info(
          'Loaded site tour images from API and merged local images:',
          mergedImages.length
        );
      }
    }
  }, [siteTourPictures, siteImages, deletedPictureIds]);

  // Display the photos newest-first by capture time. Sort a copy so the
  // underlying state stays in insertion order for the merge effect's
  // index-based change detection.
  const sortedSiteImages = [...siteImages].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    // Newest-first. Tie-break on id so equal/unparseable timestamps keep a
    // deterministic order instead of collapsing.
    if (tb !== ta && !Number.isNaN(ta) && !Number.isNaN(tb)) {
      return tb - ta;
    }
    return Number(b.id) - Number(a.id);
  });
  const hasNewImages = (siteImages || []).some((img) => !img.isFromAPI);
  const hasChanges = hasNewImages || (deletedPictureIds && deletedPictureIds.length > 0);
  const openImagePicker = () => {
    openCamera();
  };

  // Stamp lat/long + timestamp onto the photo the moment it's shot, not when
  // the user later hits Upload — so the burned-in coordinates and time reflect
  // where/when the picture was actually taken. Coordinates are already
  // resolved by the capture gate (acquireCaptureCoords) before the camera
  // opened.
  const processCapturedImage = async (asset, coords) => {
    try {
      const timestamp = new Date();
      // Persist to durable storage FIRST so the raw camera temp is consumed
      // immediately.
      const durableUri = await persistCapture({
        uri: asset.uri,
        serverAssessmentId: assessmentId,
        bucket: 'site_tour',
        label: 'site tour photo'
      });
      const stampedUri = await stampCapture({
        uri: durableUri,
        serverAssessmentId: assessmentId,
        bucket: 'site_tour',
        latitude: coords.latitude,
        longitude: coords.longitude,
        timestamp,
        label: 'site tour photo'
      });
      setSelectedImage(stampedUri);
      setCapturedMeta({ latitude: coords.latitude, longitude: coords.longitude, timestamp });
    } catch (error) {
      Logger.error('Error stamping site-tour image:', error);
      // Capture/persist failed (empty file) — don't stage a doomed raw uri.
      setSelectedImage(null);
      setCapturedMeta(null);
      const message = typeof error === 'string' ? error : error?.message;
      showWarningToast('Capture Failed', message || 'Could not save the photo. Please retake it.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const openCamera = async () => {
    const cameraGranted = await ensurePermission('camera');
    if (!cameraGranted) {
      return;
    }

    // Site-tour photos are geo-verification evidence: obtain a valid fix
    // BEFORE the camera opens and block the capture entirely if none is
    // available, so a coordinate-less photo can never be taken.
    setIsProcessingImage(true);
    const coords = await acquireCaptureCoords();
    if (!coords) {
      setIsProcessingImage(false);
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
        setIsProcessingImage(false);
      } else if (response.assets && response.assets[0]) {
        processCapturedImage(response.assets[0], coords);
      } else {
        setIsProcessingImage(false);
      }
    });
  };

  const handleSaveImage = async () => {
    if (saveImageDisabled) {
      return;
    }
    if (pictureTitle.trim() === '') {
      Logger.warn('Error', 'Please enter a title for the picture.');
      return;
    }
    if (!selectedImage) {
      Logger.warn('Error', 'Please select an image first.');
      return;
    }
    setSaveImageDisabled(true);

    // Location + timestamp were captured (and burned into the image) at shot
    // time in processCapturedImage; reuse them rather than re-reading now.
    const meta = capturedMeta || { latitude: null, longitude: null, timestamp: new Date() };
    const hasLatLng = Number.isFinite(meta.latitude) && Number.isFinite(meta.longitude);
    const coordinates = hasLatLng
      ? `${meta.latitude.toFixed(6)}, ${meta.longitude.toFixed(6)}`
      : 'Location unavailable';

    const newImage = {
      id: Date.now(),
      uri: selectedImage,
      title: pictureTitle.trim(),
      timestamp: meta.timestamp,
      coordinates,
      latitude: meta.latitude,
      longitude: meta.longitude,
      // Staged this session, not yet queued to the outbox — "Unsaved" until Save.
      syncState: 'pending'
    };

    setSiteImages((prev) => [...prev, newImage]);
    Logger.info('Site tour image saved with coordinates:', coordinates);

    setPictureTitle('');
    setSelectedImage(null);
    setCapturedMeta(null);
    setSaveImageDisabled(false);
    refRBSheet.current.close();
  };

  const renderSiteImage = ({ item }) => {
    // Only allow delete for API images if teamMemberId matches userData.user.id
    // and only show delete when there is more than one image
    let canDelete = !readOnly;
    if (canDelete && item.isFromAPI && item.teamMemberId && userData?.user?.id) {
      canDelete = item.teamMemberId === userData.user.id;
    }
    if (!((siteImages?.length || 0) > 1)) {
      canDelete = false;
    }
    return (
      <SiteTourImage
        user={
          item?.user
            ? item.user
            : `${userData?.user?.firstName || ''} ${userData?.user?.lastName || ''}`
        }
        item={item}
        onDelete={() => {
          setImageToDelete(item.id);
          setModalOpen(true);
        }}
        assessmentId={assessmentId}
        canDelete={canDelete}
      />
    );
  };
  const keyExtractor = (item) => item.id.toString();

  const ListHeaderComponent = () => (
    <View style={styles.imageListHeader}>
      <View style={styles.sectionTitleContainer}>
        <View style={[commonStyles.row, { gap: SPACING.sp6, alignItems: 'center' }]}>
          <Text style={styles.sectionTitle}>Site Photos</Text>
          {isServiceSector ? (
            <Text style={styles.photoCount}>{siteImages.length}/150</Text>
          ) : (
            <Text style={styles.photoCount}>{siteImages.length}/25</Text>
          )}
        </View>
        {!readOnly && !isServiceSector && siteImages.length < 25 && (
          <TouchableOpacity
            onPress={() => {
              setSelectedImage(null);
              setPictureTitle('');
              setCapturedMeta(null);
              refRBSheet.current.open();
            }}
            activeOpacity={0.6}>
            <Text style={styles.addImageText}>+ Add Image</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const SiteTourHandler = async () => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);

    // Filter only new images (not from API)
    const newImages = siteImages.filter((img) => !img.isFromAPI);
    const hasDeletions = deletedPictureIds && deletedPictureIds.length > 0;

    if (newImages.length === 0 && !hasDeletions) {
      Logger.warn('No changes', 'No new images to upload and no deletions.');
      setIsSaving(false);
      navigation.goBack();
      return;
    }

    try {
      // Upload one at a time, not in parallel: a burst of concurrent uploads for
      // the same assessment intermittently trips a server-side race and returns
      // "Failed to upload …" for some photos. Serialising removes the race; each
      // still goes through the offline-first action (persist + outbox, drain), so
      // a failure just leaves that row queued.
      for (const image of newImages) {
        await dispatch(
          addSiteTourPictureAction({
            assessmentId,
            title: image.title,
            uri: image.uri,
            latitude: image.latitude,
            longitude: image.longitude,
            // Real capture time, taken when the photo was shot. Without this the
            // server stamps capturedAt at save time, collapsing the capture order.
            capturedAt:
              image.timestamp instanceof Date ? image.timestamp.toISOString() : image.timestamp
          })
        ).unwrap();
        Logger.info(`${image.title} captured`);
      }
      // Process deletions marked locally
      if (deletedPictureIds && deletedPictureIds.length > 0) {
        for (const picId of Array.from(new Set(deletedPictureIds))) {
          try {
            await dispatch(
              deleteSiteTourPictureAction({ assessmentId: assessmentId, pictureId: picId })
            ).unwrap();
            Logger.info('Deleted marked site tour picture:', picId);
          } catch (err) {
            Logger.error('Failed to delete marked site tour picture:', picId, err);
          }
        }
        // Keep the deleted ids until the screen unmounts: the store still holds
        // the old list until the refetch lands, and clearing them here made the
        // deleted photos reappear in the count for a moment (N+1, then N).
      }
      Logger.info(`${newImages.length} site tour images uploaded successfully`);
      await dispatch(getStepProgressAction(assessmentId));
      await dispatch(getAssessmentByIdAction(assessmentId));
      setSuccessModal(true);
      setTimeout(async () => {
        // User may have navigated back during the 2s window — don't fire
        // state updates / a second goBack on an unmounted screen.
        if (!navigation.isFocused()) {
          return;
        }
        setSuccessModal(false);

        navigation.goBack();
        setIsSaving(false);
      }, 2000);
      // Navigate back or to next screen
    } catch (error) {
      Logger.error('Error uploading site tour images:', error);
      setIsSaving(false);
      // Surface a "please retake" rejection (empty/missing capture file) rather
      // than failing silently — see recordSiteTourPicture / persistPhoto. The
      // thunk rejects via rejectWithValue(error.message), so unwrap() throws the
      // string payload, not an Error.
      const message = typeof error === 'string' ? error : error?.message;
      showWarningToast(
        'Save Failed',
        message || 'Could not save the site tour photos. Please try again.'
      );
    }
  };

  // Service-sector display screen: show applicant-uploaded tour photos read-only.
  if (isServiceSector) {
    // Newest-first by capture time so the most recently picked photo sits on top.
    // Tie-break on id so equal/unparseable timestamps keep a deterministic order.
    const pool = [...(siteTourPictures?.pictures || [])].sort((a, b) => {
      const ta = new Date(a.capturedAt).getTime();
      const tb = new Date(b.capturedAt).getTime();
      if (tb !== ta && !Number.isNaN(ta) && !Number.isNaN(tb)) {
        return tb - ta;
      }
      return Number(b.id) - Number(a.id);
    });
    return (
      <View style={[commonStyles.fill, { backgroundColor: COLORS.background.secondary }]}>
        <Header title="Site Tour" back={true} />
        <View style={[commonStyles.fill]}>
          {showInitialLoader && pool.length === 0 ? (
            <ScreenLoader />
          ) : pool.length === 0 ? (
            <AppEmptyState
              EmptyImage={Images.emptyStateGateImage}
              heading="No Site Tour Photos Yet"
              subHeading="The applicant has not uploaded any site tour photos yet."
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
                      : 'Location unavailable'
                  }
                  timestamp={item.capturedAt}
                  syncState="synced"
                  style={{
                    marginBottom: Responsive.height(20),
                    paddingHorizontal: Responsive.width(16)
                  }}
                />
              )}
              ListHeaderComponent={
                <View style={styles.sectionTitleContainer}>
                  <View style={[commonStyles.row, { gap: SPACING.sp6, alignItems: 'center' }]}>
                    <Text style={styles.sectionTitle}>Site Tour Photos</Text>
                    <Text style={styles.photoCount}>{pool.length} photos</Text>
                  </View>
                </View>
              }
              ItemSeparatorComponent={() => <View style={styles.photoSeparator} />}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: Responsive.height(20),
                backgroundColor: COLORS.background.primary
              }}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[commonStyles.fill, { backgroundColor: COLORS.background.secondary }]}>
      <Header title="Site Tour" back={true} />
      <View style={[commonStyles.fill]}>
        {siteImages.length === 0 ? (
          <AppEmptyState
            EmptyImage={Images.emptyStateGateImage}
            heading="No Site Photos Yet"
            subHeading={
              isServiceSector
                ? 'Site photos are not required for service assessments.'
                : 'Start by uploading images from your site visit'
            }
            button={!readOnly && !isServiceSector}
            content="Capture Picture"
            onPress={() => {
              setSelectedImage(null);
              setPictureTitle('');
              setCapturedMeta(null);
              refRBSheet.current.open();
            }}
          />
        ) : (
          <View style={[commonStyles.fill]}>
            <View style={[commonStyles.fill]}>
              <FlatList
                data={sortedSiteImages}
                renderItem={renderSiteImage}
                keyExtractor={keyExtractor}
                ListHeaderComponent={ListHeaderComponent}
                // ListFooterComponent={ListFooterComponent}
                contentContainerStyle={styles.imageListContainer}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={10}
                initialNumToRender={5}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              />
            </View>
            {/* Save & Next Button */}
            {readOnly ? null : (
              <View style={styles.saveButtonContainer}>
                <AppButton
                  disabled={!hasChanges || isSaving}
                  size="large"
                  title="Save"
                  onPress={SiteTourHandler}
                  loader={isSaving}
                />
              </View>
            )}
          </View>
        )}
      </View>
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
        onPress={async () => {
          if (imageToDelete) {
            await siteTourImageDelete(imageToDelete);
          }
        }}
        leftvariant="secondary"
        variant="danger"
      />
      <AppBottomSheet
        ref={refRBSheet}
        snapPoints={[
          Platform.select({
            android: 520,
            ios: 500
          })
        ]}>
        <View
          style={[
            commonStyles.center,
            {
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border.light,
              paddingBottom: Responsive.height(15)
            }
          ]}>
          <Text style={[commonStyles.h2heading600]}>Capture Site Picture</Text>
        </View>
        <View style={[commonStyles.fill]}>
          <View
            style={[
              commonStyles.fill,
              commonStyles.paddingHorizontal16,
              { paddingVertical: Responsive.height(20) }
            ]}>
            {/* Image Upload Section */}
            <View style={styles.imageUploadSection}>
              {isProcessingImage ? (
                <View style={[styles.imagePickerButton, styles.imagePickerContent]}>
                  <ActivityIndicator size="large" color={COLORS.primary.main} />
                  <Text style={styles.imageProcessingText}>Processing picture...</Text>
                </View>
              ) : selectedImage ? (
                <ImageUploaderUI
                  // title="Selected Image"
                  image={selectedImage}
                  onDelete={() => {
                    setSelectedImage(null);
                    setCapturedMeta(null);
                  }}
                  showMetadata={false}
                  style={styles.selectedImageStyle}
                />
              ) : (
                <TouchableOpacity
                  style={styles.imagePickerButton}
                  onPress={openImagePicker}
                  activeOpacity={0.6}>
                  <View style={styles.imagePickerContent}>
                    <View style={styles.cameraIconContainer}>
                      <Image source={Icons.cameraIcon} style={[commonStyles.iconSize40]} />
                    </View>
                    <Text style={styles.imagePickerText}>Capture Picture</Text>
                    <Text style={styles.imagePickerSubText}>Tap to select from camera</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
            {/* Title Input */}
            <View style={styles.titleInputContainer}>
              <AppInput
                maxLength={100}
                label={'Title for Picture'}
                placeholderText={'Enter Picture Title'}
                value={pictureTitle}
                onChange={setPictureTitle}
                asterisk={true}
              />
            </View>
          </View>
          <View
            style={[
              commonStyles.paddingHorizontal16,
              {
                paddingVertical: Responsive.height(16),
                borderTopWidth: 1,
                borderTopColor: COLORS.border.light
              }
            ]}>
            <AppButton
              size="large"
              title="Upload Image"
              onPress={handleSaveImage}
              disabled={saveImageDisabled || !selectedImage || pictureTitle.trim() === ''}
              loader={saveImageDisabled}
            />
          </View>
        </View>
      </AppBottomSheet>
      <AppCommonModal
        showmodal={successModal}
        imgsrc={Icons.success}
        title="Site Tour Added"
        subTitle="Your site Tour has been added successfully."
      />
    </View>
  );
};

const styles = {
  imageListContainer: {
    backgroundColor: COLORS.background.primary
  },
  imageListHeader: {},
  sectionTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...commonStyles.paddingHorizontal16,
    paddingTop: Responsive.height(16),
    paddingBottom: Responsive.height(12)
  },
  sectionTitle: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.heading
  },
  photoCount: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs14,
    borderRadius: BORDER_RADIUS.br10,
    paddingHorizontal: SPACING.sp8,
    color: COLORS.status.infoText,
    backgroundColor: COLORS.status.infoBackground
  },
  addImageButton: {
    backgroundColor: COLORS.primary.soft,
    paddingHorizontal: Responsive.width(12),
    paddingVertical: Responsive.height(8),
    borderRadius: BORDER_RADIUS.br8
  },
  addImageText: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.primary.main
  },
  siteImageCard: {
    ...commonStyles.paddingHorizontal16,
    backgroundColor: COLORS.background.primary,
    paddingVertical: Responsive.height(12)
  },
  itemSeparator: {
    height: Responsive.height(4),
    backgroundColor: COLORS.background.secondary
  },
  photoSeparator: {
    height: 1,
    backgroundColor: '#EBEDF3',
    marginBottom: Responsive.height(12),
    marginHorizontal: Responsive.width(16)
  },
  siteImageThumbnail: {
    width: Responsive.width(80),
    height: Responsive.height(80),
    borderRadius: BORDER_RADIUS.br12,
    marginRight: SPACING.sp12
  },
  siteImageContent: {
    flex: 1,
    justifyContent: 'center'
  },
  siteImageTitle: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.heading,
    marginBottom: Responsive.height(4)
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Responsive.height(2)
  },
  coordinatesText: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.primary.main,
    marginLeft: SPACING.sp6
  },
  timestampText: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    marginLeft: SPACING.sp6
  },
  uploadedByText: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.tertiary
  },
  deleteIconButton: {
    alignSelf: 'flex-start',
    marginTop: Responsive.height(28)
  },
  deleteIcon: {
    width: Responsive.width(20),
    height: Responsive.height(20),
    tintColor: COLORS.error.main
  },
  commentSection: {
    paddingVertical: Responsive.height(20),
    paddingHorizontal: SPACING.sp16,
    borderTopWidth: 4,
    borderTopColor: COLORS.border.light
  },
  commentTitle: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs18,
    color: COLORS.text.heading,
    marginBottom: Responsive.height(12)
  },
  commentInputContainer: {
    position: 'relative'
  },
  characterCount: {
    ...commonStyles.FontFamily_Regular400,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.tertiary,
    textAlign: 'right',
    marginTop: Responsive.height(8)
  },
  saveButtonContainer: {
    backgroundColor: COLORS.background.primary,
    padding: SPACING.sp16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light
  },
  imageUploadSection: {
    marginBottom: Responsive.height(16)
  },
  imageProcessingContainer: {
    backgroundColor: COLORS.background.muted,
    borderRadius: BORDER_RADIUS.br12,
    borderWidth: 2,
    borderColor: COLORS.primary.soft,
    borderStyle: 'dashed',
    minHeight: Responsive.height(120),
    justifyContent: 'center',
    alignItems: 'center'
  },
  imageProcessingText: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.primary.main,
    marginTop: Responsive.height(8)
  },
  imagePickerButton: {
    backgroundColor: COLORS.background.muted,
    borderRadius: BORDER_RADIUS.br12,
    borderWidth: 2,
    borderColor: COLORS.primary.soft,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    height: 150
  },
  imagePickerContent: {
    alignItems: 'center',
    paddingVertical: SPACING.sp30
  },
  cameraIconContainer: {
    marginBottom: Responsive.height(8)
  },
  cameraIcon: {
    fontSize: 40
  },
  imagePickerText: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.primary.main,
    marginBottom: Responsive.height(4)
  },
  imagePickerSubText: {
    ...commonStyles.FontFamily_Regular400,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.tertiary,
    textAlign: 'center'
  },
  selectedImageStyle: {
    marginBottom: 0
  },
  titleInputContainer: {
    flex: 1
  }
};

export default SiteTour;
