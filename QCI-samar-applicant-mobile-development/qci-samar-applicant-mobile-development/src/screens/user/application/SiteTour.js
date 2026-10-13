import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../../assets/theme/Layout';
import { commonStyles } from '../../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../../assets/theme/Theme';
import SiteTourImage from '../../../components/assessment/SiteTourImage';
import AppButton from '../../../components/base/AppButton';
import AppEmptyState from '../../../components/base/AppEmptyState';
import AppInput from '../../../components/base/textInput/AppInput';
import ImageUploaderUI from '../../../components/common/ImageUploaderUI';
import Header from '../../../components/layout/Header';
import AppCommonModal from '../../../components/modals/AppCommonModal';
import AppBottomSheet from '../../../components/shared/AppBottomSheet';
import ApplicationLoader from '../../../components/shared/Loader';
import Icons from '../../../constants/Icons';
import Images from '../../../constants/Images';
import { getStepProgress } from '../../../redux/action/applicationAction';
import { getSiteTourPictures } from '../../../redux/action/siteAction';
import {
  discardPendingCapture,
  loadPendingCaptures,
} from '../../../services/offline/pendingCaptures';
import { recordSiteTourPicture } from '../../../services/offline/recordSiteTourPicture';
import { recordSiteTourPictureDelete } from '../../../services/offline/recordSiteTourPictureDelete';
import {
  cacheServerPictures,
  loadCachedPictures,
} from '../../../services/offline/sitePictureCache';
import { getToken } from '../../../services/storage/authStore';
import {
  acquireCaptureCoords,
  ensurePermission,
  getImagePickerOptions,
  isCommentValid,
  Logger,
  prepareCapturedPhoto,
} from '../../../utils';

const MAX_PHOTOS = 150;

/**
 * SiteTour — capture up to 25 geotagged/watermarked site-tour photos with a
 * title each (via a bottom sheet), preview them in a list, and upload them
 * against the assessment.
 */
const SiteTour = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { assessmentId, readOnly: readOnlyParam } = route.params || {};
  const refRBSheet = useRef(null);

  const [siteImages, setSiteImages] = useState([]);
  const [pictureTitle, setPictureTitle] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  // Capture → coords lookup → compression takes a moment after the camera
  // closes; drives a loader in the sheet so the box isn't blank meanwhile.
  const [processingImage, setProcessingImage] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState(null);
  const [successModal, setSuccessModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Ids of already-uploaded tour photos the user removed this session. The
  // delete is deferred to Save so it's batched with the new uploads.
  const [deletedPictureIds, setDeletedPictureIds] = useState([]);
  // Gate the empty state until the first fetch of already-uploaded photos
  // resolves, so re-opening an application never flashes "No Site Photos Yet"
  // before the saved photos load in. Starts loading only when there is an
  // assessment to fetch for.
  const [initialLoading, setInitialLoading] = useState(!!assessmentId);

  const { siteTourPicturesLoading } = useSelector(state => state.site);

  // The on-site unit admin and the enterprise admin can both capture and delete
  // site-tour photos. Any other role gets a read-only view of the uploads.
  const { userData } = useSelector(state => state.account);
  const canEdit = (userData?.user?.roles || []).some(
    role => role.slug === 'unit_admin' || role.slug === 'enterprise_admin',
  );
  // Also read-only once the lead has punched out: the captured tour stays
  // viewable, but Add Image, delete and Save are all withheld — an upload now
  // would only be rejected server-side. ApplicationDetail resolves that gate
  // and passes it in.
  const readOnly = !canEdit || readOnlyParam === true;

  useEffect(() => {
    if (!assessmentId) {
      return;
    }
    let active = true;
    (async () => {
      // Merge server photos into the same list as fresh captures, tagged
      // isFromAPI so Save skips re-uploading them and routes their deletes to
      // the delete endpoint.
      const hydrate = pictures => {
        const formatted = pictures.map(picture => {
          const hasCoords = picture.latitude != null && picture.longitude != null;
          return {
            id: picture.id,
            uri: picture.downloadUrl,
            title: picture.title,
            timestamp: picture.capturedAt ? new Date(picture.capturedAt) : new Date(),
            coordinates: hasCoords
              ? `${parseFloat(picture.latitude).toFixed(6)}, ${parseFloat(
                  picture.longitude,
                ).toFixed(6)}`
              : 'Location unavailable',
            latitude: hasCoords ? parseFloat(picture.latitude) : null,
            longitude: hasCoords ? parseFloat(picture.longitude) : null,
            isFromAPI: true,
            syncState: 'synced',
          };
        });
        setSiteImages(prev => [...formatted, ...prev.filter(img => !img.isFromAPI)]);
      };

      // Overlay tour photos still queued in the outbox on top of the server /
      // cache hydrate. Flagged isPending so Save never re-uploads them (they're
      // already queued) and their id is the stable op_key so a re-run of this
      // effect replaces rather than duplicates them.
      const overlayPending = async () => {
        let pending = [];
        try {
          pending = await loadPendingCaptures({ assessmentId, kind: 'tour' });
        } catch (err) {
          Logger.warn('Could not load pending site tour pictures:', err?.message || err);
          return;
        }
        if (!active || pending.length === 0) {
          return;
        }
        const pendingItems = pending.map(cap => {
          const hasCoords = cap.latitude != null && cap.longitude != null;
          return {
            id: cap.opKey,
            opKey: cap.opKey,
            uri: cap.filePath,
            title: cap.title,
            timestamp: cap.capturedAt ? new Date(cap.capturedAt) : new Date(),
            coordinates: hasCoords
              ? `${parseFloat(cap.latitude).toFixed(6)}, ${parseFloat(cap.longitude).toFixed(6)}`
              : 'Location unavailable',
            latitude: hasCoords ? parseFloat(cap.latitude) : null,
            longitude: hasCoords ? parseFloat(cap.longitude) : null,
            isPending: true,
            syncState: cap.stuck ? 'failed' : 'pending',
          };
        });
        setSiteImages(prev => [...prev.filter(img => !img.isPending), ...pendingItems]);
      };

      try {
        const body = await dispatch(getSiteTourPictures(assessmentId)).unwrap();
        const pictures = body?.data?.pictures || [];
        if (!active) {
          return;
        }
        // Render from the durable local cache, not the protected downloadUrl:
        // the native image loader renders the authenticated remote URL
        // unreliably (black tile), so mirror the offline path — write the photos
        // through to the cache, then hydrate from the local file:// copies.
        // Falls back to the remote url per-picture only when its download was
        // skipped or failed.
        const token = await getToken('accessToken');
        const authHeader = token?.token ? { Authorization: `Bearer ${token.token}` } : null;
        await cacheServerPictures({
          assessmentId,
          kind: 'tour',
          pictures,
          authHeader,
        });
        if (!active) {
          return;
        }
        const cached = await loadCachedPictures({ assessmentId, kind: 'tour' });
        const cachedById = new Map(cached.map(p => [String(p.id), p]));
        hydrate(pictures.map(p => cachedById.get(String(p.id)) || p));
      } catch (error) {
        // Offline (or the GET failed): fall back to the local read-cache so
        // previously-uploaded photos still rehydrate. Cached uris are local
        // file:// paths AppFastImage renders directly.
        Logger.error('Could not load existing site tour pictures:', error);
        try {
          const cached = await loadCachedPictures({
            assessmentId,
            kind: 'tour',
          });
          if (active && cached.length > 0) {
            hydrate(cached);
          }
        } catch (cacheError) {
          Logger.warn(
            'Could not load cached site tour pictures:',
            cacheError?.message || cacheError,
          );
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

  // Drive the global loader off the initial rehydrate and the site-tour GET of
  // already-uploaded photos. Covering initialLoading keeps the overlay up until
  // the saved photos are in state, so the "No Site Photos Yet" empty state never
  // flashes. Save is not covered here — it shows its own success modal.
  useEffect(() => {
    if (initialLoading || siteTourPicturesLoading) {
      ApplicationLoader.show();
    } else {
      ApplicationLoader.hide();
    }
  }, [initialLoading, siteTourPicturesLoading]);

  // Save is meaningful only when there's something to send: a freshly captured
  // photo not yet queued, or an already-uploaded one queued for deletion.
  // Pending (already-queued) photos don't count — they sync on their own.
  const hasChanges =
    siteImages.some(img => !img.isFromAPI && !img.isPending) || deletedPictureIds.length > 0;

  // Display most-recent first by capture time; underlying state keeps
  // insertion order.
  const sortedSiteImages = [...siteImages].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const openImagePicker = async () => {
    const cameraGranted = await ensurePermission('camera');
    if (!cameraGranted) {
      return;
    }

    // Site photos are geo-verification evidence: obtain a valid fix BEFORE the
    // camera opens and block the capture entirely if none is available, so a
    // coordinate-less photo can never be taken. acquireCaptureCoords shows a
    // single "Location Required" message and returns null on failure.
    setProcessingImage(true);
    const coords = await acquireCaptureCoords();
    if (!coords) {
      setProcessingImage(false);
      return;
    }

    const options = getImagePickerOptions({
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.8,
    });
    launchCamera(options, async response => {
      if (response.didCancel || response.errorCode) {
        Logger.warn('Camera capture cancelled or error');
        setProcessingImage(false);
        return;
      }
      if (!response.assets || !response.assets[0]) {
        setProcessingImage(false);
        return;
      }
      try {
        // Persist to a durable, geotagged file immediately — before the user
        // types a title — so the preview and the eventual upload never depend on
        // the volatile camera temp (which Android can evict during title entry).
        const capturedAt = new Date();
        const preparedUri = await prepareCapturedPhoto({
          uri: response.assets[0].uri,
          assessmentId,
          bucket: 'site_tour',
          latitude: coords.latitude,
          longitude: coords.longitude,
          timestamp: capturedAt,
          label: 'site tour photo',
        });
        setSelectedImage({
          uri: preparedUri,
          latitude: coords.latitude,
          longitude: coords.longitude,
          capturedAt,
        });
      } catch (error) {
        Logger.error('Error preparing site tour photo:', error);
        const message = typeof error === 'string' ? error : error?.message;
        Alert.alert('Capture Failed', message || 'Could not save the photo. Please retake it.');
      } finally {
        setProcessingImage(false);
      }
    });
  };

  const handleSaveImage = () => {
    if (!isCommentValid(pictureTitle)) {
      Logger.warn('Please enter a title for the picture.');
      return;
    }
    if (!selectedImage) {
      Logger.warn('Please select an image first.');
      return;
    }

    // selectedImage.uri is already the durable, geotagged file (persisted at
    // capture time), so just stage it into the list — no volatile temp is ever
    // held past the capture handler, and Upload uploads this persisted file.
    const { uri, latitude, longitude, capturedAt } = selectedImage;
    const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);

    setSiteImages(prev => [
      ...prev,
      {
        id: Date.now(),
        uri,
        title: pictureTitle.trim(),
        timestamp: capturedAt || new Date(),
        coordinates: hasCoords
          ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          : 'Location unavailable',
        latitude: hasCoords ? latitude : null,
        longitude: hasCoords ? longitude : null,
        // Staged this session, not yet queued to the outbox — "Unsaved" until Save.
        syncState: 'pending',
      },
    ]);
    setPictureTitle('');
    setSelectedImage(null);
    refRBSheet.current?.close();
  };

  const confirmDeleteImage = id => {
    const target = siteImages.find(img => img.id === id);
    setSiteImages(prev => prev.filter(img => img.id !== id));
    // Already-uploaded photo: queue its server delete for Save.
    if (target?.isFromAPI) {
      setDeletedPictureIds(prev => [...prev, id]);
    } else if (target?.isPending) {
      // Queued offline but never sent: cancel the pending upload outright
      // (outbox row + its durable file) instead of leaving it to sync.
      discardPendingCapture({
        opKey: target.opKey,
        filePath: target.uri,
      }).catch(err => Logger.warn('Could not discard pending tour photo:', err?.message || err));
    }
    setModalOpen(false);
    setImageToDelete(null);
  };

  const SiteTourHandler = async () => {
    if (isSaving) {
      return;
    }

    // Only freshly captured, not-yet-queued photos get uploaded; already-
    // uploaded ones (isFromAPI) and already-queued offline ones (isPending) are
    // skipped so a revisit can never re-enqueue a duplicate of a pending photo.
    const newImages = siteImages.filter(img => !img.isFromAPI && !img.isPending);
    const hasDeletions = deletedPictureIds.length > 0;

    if (newImages.length === 0 && !hasDeletions) {
      navigation.goBack();
      return;
    }

    if (!assessmentId) {
      Logger.error('Missing assessmentId, cannot upload site tour images.');
      Alert.alert('Upload Failed', 'Assessment details are unavailable. Please try again later.');
      return;
    }

    setIsSaving(true);
    try {
      // Offline-first: each new photo is queued to the outbox and, when online,
      // uploaded inline; offline it stays queued and auto-syncs on reconnect.
      await Promise.all(
        newImages.map(image =>
          recordSiteTourPicture({
            serverAssessmentId: assessmentId,
            title: image.title,
            uri: image.uri,
            latitude: image.latitude,
            longitude: image.longitude,
            capturedAt: image.timestamp,
          }),
        ),
      );

      // Queue the deletions of previously-uploaded photos (server ids).
      for (const pictureId of Array.from(new Set(deletedPictureIds))) {
        try {
          await recordSiteTourPictureDelete({
            serverAssessmentId: assessmentId,
            pictureId,
          });
        } catch (err) {
          Logger.error('Failed to delete site tour picture:', pictureId, err);
        }
      }
      setDeletedPictureIds([]);

      // Refresh step progress so the detail screen reflects site_tour as
      // completed when the user returns. Best-effort: offline it no-ops.
      await dispatch(getStepProgress(assessmentId));

      setSuccessModal(true);
      setTimeout(() => {
        setSuccessModal(false);
        setIsSaving(false);
        navigation.goBack();
      }, 2000);
    } catch (error) {
      Logger.error('Error saving site tour images:', error);
      setIsSaving(false);
      // record* only throws on an unrecoverable capture (empty/missing file);
      // network problems are absorbed into the outbox.
      const message = typeof error === 'string' ? error : error?.message;
      Alert.alert(
        'Save Failed',
        message || 'Could not save your site tour photos. Please retake and try again.',
      );
    }
  };

  const openSheet = () => {
    setSelectedImage(null);
    setPictureTitle('');
    refRBSheet.current?.open();
  };

  const renderSiteImage = ({ item }) => (
    <SiteTourImage
      item={item}
      onDelete={() => {
        setImageToDelete(item.id);
        setModalOpen(true);
      }}
      canDelete={!readOnly && siteImages.length > 1}
    />
  );

  const ListHeaderComponent = () => (
    <View>
      <View style={styles.sectionTitleContainer}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Site Photos</Text>
          <View style={styles.photoCountBadge}>
            <Text style={styles.photoCount}>
              {siteImages.length}
              <Text style={styles.photoCountTotal}> / {MAX_PHOTOS}</Text>
            </Text>
          </View>
        </View>
        {!readOnly && siteImages.length < MAX_PHOTOS && (
          <TouchableOpacity onPress={openSheet} activeOpacity={0.6}>
            <Text style={styles.addImageText}>+ Add Image</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={[commonStyles.fill, { backgroundColor: COLORS.background.secondary }]}>
      <Header title="Site Tour" back={true} syncStatus={true} />
      <View style={[commonStyles.fill]}>
        {initialLoading ? null : siteImages.length === 0 ? (
          <AppEmptyState
            EmptyImage={Images.emptyStateGateImage}
            heading="No Site Photos Yet"
            subHeading={
              readOnly
                ? 'The unit admin has not uploaded any site tour photos yet'
                : 'Start by uploading images from your site visit'
            }
            button={!readOnly}
            content="Capture Picture"
            onPress={openSheet}
          />
        ) : (
          <View style={[commonStyles.fill]}>
            <FlatList
              data={sortedSiteImages}
              renderItem={renderSiteImage}
              keyExtractor={item => item.id.toString()}
              ListHeaderComponent={ListHeaderComponent}
              contentContainerStyle={styles.imageListContainer}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={10}
              initialNumToRender={5}
            />
            {!readOnly && siteImages.length > 0 && (
              <View style={styles.saveButtonContainer}>
                <AppButton
                  disabled={isSaving || !hasChanges}
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
        onPress={() => {
          if (imageToDelete != null) {
            confirmDeleteImage(imageToDelete);
          }
        }}
        leftvariant="secondary"
        variant="danger"
      />
      <AppBottomSheet
        ref={refRBSheet}
        footerComponent={
          <View
            style={[
              commonStyles.paddingHorizontal16,
              {
                paddingVertical: Responsive.height(16),
                borderTopWidth: 1,
                borderTopColor: COLORS.border.light,
              },
            ]}>
            <AppButton
              size="large"
              title="Upload Image"
              onPress={handleSaveImage}
              disabled={!selectedImage || !isCommentValid(pictureTitle)}
            />
          </View>
        }
        snapPoints={[Platform.select({ android: 550, ios: 500 })]}>
        <View
          style={[
            commonStyles.center,
            {
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border.light,
              paddingBottom: Responsive.height(15),
            },
          ]}>
          <Text style={[commonStyles.h2heading600]}>Capture Site Picture</Text>
        </View>
        <View style={[commonStyles.fill]}>
          <View
            style={[
              commonStyles.fill,
              commonStyles.paddingHorizontal16,
              { paddingVertical: Responsive.height(20) },
            ]}>
            <View style={styles.imageUploadSection}>
              {processingImage ? (
                <View style={styles.imageProcessing}>
                  <ActivityIndicator size="large" color={COLORS.primary.main} />
                  <Text style={styles.imageProcessingText}>Processing picture...</Text>
                </View>
              ) : selectedImage ? (
                <ImageUploaderUI
                  image={selectedImage.uri}
                  onDelete={() => setSelectedImage(null)}
                  isDelete={true}
                  showMetadata={false}
                  style={styles.selectedImageStyle}
                />
              ) : (
                <TouchableOpacity
                  style={styles.imagePickerButton}
                  onPress={openImagePicker}
                  activeOpacity={0.6}>
                  <View style={styles.imagePickerContent}>
                    <Image source={Icons.cameraIcon} style={[commonStyles.iconSize40]} />
                    <Text style={styles.imagePickerText}>Capture Picture</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
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
        </View>
      </AppBottomSheet>
      <AppCommonModal
        showmodal={successModal}
        imgsrc={Icons.success}
        title="Site Tour Added"
        subTitle="Your site tour has been added successfully."
      />
    </View>
  );
};

const styles = {
  uploadedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success.light,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.success.clarity,
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(12),
  },
  imageListContainer: {
    backgroundColor: COLORS.background.primary,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...commonStyles.paddingHorizontal16,
    paddingTop: Responsive.height(16),
  },
  sectionTitle: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.heading,
  },
  sectionTitleRow: {
    ...commonStyles.row,
    gap: SPACING.sp6,
    alignItems: 'center',
  },
  photoCountBadge: {
    ...commonStyles.row,
    gap: SPACING.sp6,
    alignItems: 'center',
    backgroundColor: '#ECF3FF',
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: SPACING.sp6,
    height: 18,
    justifyContent: 'center',
  },
  photoCount: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.primary.main,
  },
  photoCountTotal: {
    fontSize: FONT_SIZE.fs12,
  },
  addImageText: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.primary.main,
  },
  itemSeparator: {
    height: Responsive.height(4),
    backgroundColor: COLORS.background.secondary,
  },
  saveButtonContainer: {
    backgroundColor: COLORS.background.primary,
    padding: SPACING.sp16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
  },
  imageUploadSection: {
    marginBottom: Responsive.height(16),
  },
  imagePickerButton: {
    backgroundColor: COLORS.background.muted,
    borderRadius: BORDER_RADIUS.br12,
    borderWidth: 2,
    borderColor: COLORS.primary.soft,
    borderStyle: 'dashed',
    height: Responsive.height(150),
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerContent: {
    alignItems: 'center',
    paddingVertical: SPACING.sp30,
  },
  imageProcessing: {
    backgroundColor: COLORS.background.muted,
    borderRadius: BORDER_RADIUS.br12,
    borderWidth: 2,
    borderColor: COLORS.primary.soft,
    borderStyle: 'dashed',
    height: Responsive.height(150),
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageProcessingText: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.primary.main,
    marginTop: 8,
  },
  imagePickerText: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.primary.main,
    marginTop: 8,
  },
  selectedImageStyle: {
    marginBottom: 0,
  },
  titleInputContainer: {
    flex: 1,
  },
};

export default SiteTour;
