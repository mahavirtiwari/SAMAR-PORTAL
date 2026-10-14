import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONTS_FAMILY, SPACING } from '../../../../assets/theme/Theme';
import AppButton from '../../../../components/base/AppButton';
import AppSkeletonPlaceholder from '../../../../components/base/AppSkeletonPlaceholder';
import { Header } from '../../../../components/layout';
import { AppModal } from '../../../../components/modals';
import { resolvePhotoPath } from '../../../../services/offline/photoStorage';
import { styles } from './assessmentStepsStyles';

const PunchModal = ({
  visible,
  isPunchedIn,
  onClose,
  onOpened,
  selfieUri,
  device,
  isCameraActive,
  hasPermission,
  camera,
  currentTime,
  userLocation,
  locationStatus,
  onRetryLocation,
  isCheckingIn,
  onPunchIn,
  onPunchOut
}) => {
  return (
    <AppModal visible={visible} onOpened={onOpened}>
      <Header title={isPunchedIn ? 'Punch-Out' : 'Punch-In'} close={true} onPress={onClose} />
      <View style={styles.fullScreenModal}>
        <View style={styles.fullScreenContent}>
          {/* Camera Circle at Top */}
          <View style={styles.cameraContainer}>
            {selfieUri ? (
              <View style={styles.cameraCircle}>
                <Image
                  source={{ uri: resolvePhotoPath(selfieUri) }}
                  style={{ width: '100%', height: '100%', borderRadius: Responsive.width(150) }}
                  resizeMode="cover"
                />
              </View>
            ) : device && isCameraActive && hasPermission ? (
              <View
                style={{
                  borderWidth: 4,
                  borderColor: '#F5F6FA',
                  borderRadius: 170,
                  width: 268,
                  height: 268,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                <View style={styles.cameraCircle}>
                  <Camera
                    resizeMode="cover"
                    style={styles.cameraView}
                    device={device}
                    isActive={isCameraActive && visible}
                    outputs={[camera.photoOutput]}
                    onStarted={camera.onStarted}
                    onStopped={camera.onStopped}
                    onError={camera.onError}
                  />
                </View>
              </View>
            ) : (
              <View style={[styles.cameraCircle, styles.cameraPlaceholder]}>
                <View style={styles.placeholderAvatar} />
              </View>
            )}
          </View>
          <View
            style={[
              styles.timeContainer,
              {
                paddingVertical: Responsive.height(10),
                // paddingHorizontal: Responsive.width(10),
                borderRadius: BORDER_RADIUS.br14,
                alignSelf: 'center'
              }
            ]}>
            <View style={styles.timeIndicator}>
              <View>
                {/* <Image
                  style={{
                    height: Responsive.height(14),
                    width: Responsive.width(14)
                  }}
                  source={Icons.calendar}
                /> */}
                <Text
                  style={{
                    fontSize: 14,
                    color: COLORS.text.primary,
                    fontFamily: FONTS_FAMILY.SemiBold600
                  }}>
                  {currentTime}
                </Text>
              </View>
              <View>
                {/* <Image
                  style={{
                    height: Responsive.height(14),
                    width: Responsive.width(14)
                  }}
                  source={Icons.locationIcon}
                /> */}
                {userLocation ? (
                  <Text style={{ color: COLORS.text.primary, fontSize: 14, marginTop: 4 }}>
                    {userLocation?.latitude}, {userLocation?.longitude}
                  </Text>
                ) : locationStatus === 'failed' ? (
                  <View style={[commonStyles.row, { gap: SPACING.sp8, alignItems: 'center' }]}>
                    <Text style={{ color: COLORS.error.active, fontSize: 14 }}>
                      Location unavailable
                    </Text>
                    <TouchableOpacity onPress={onRetryLocation} activeOpacity={0.6}>
                      <Text
                        style={{
                          color: COLORS.primary.main,
                          fontSize: 14,
                          fontFamily: FONTS_FAMILY.SemiBold600,
                          textDecorationLine: 'underline'
                        }}>
                        Retry
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Say what is happening rather than showing a bare shimmer. A
                  // cold GPS lock takes real time — longer offline, where there
                  // is no network fix to fall back on — and an unlabelled
                  // placeholder makes that wait look like a failure.
                  <View style={{ marginTop: 6 }}>
                    <Text style={{ color: COLORS.text.secondary, fontSize: 14 }}>
                      Getting your location…
                    </Text>
                    <View style={{ marginTop: 4 }}>
                      <AppSkeletonPlaceholder>
                        <AppSkeletonPlaceholder.Item width={120} height={10} borderRadius={2} />
                      </AppSkeletonPlaceholder>
                    </View>
                  </View>
                )}
              </View>
              <View style={styles.locationContainer}></View>
            </View>
          </View>
          {/* Map Container */}
        </View>
        <View style={styles.bottomButtonContainer}>
          <View
            style={[
              commonStyles.row,
              {
                gap: SPACING.sp10,
                marginVertical: Responsive.height(20),
                paddingHorizontal: Responsive.height(15),
                borderTopWidth: 1,
                borderTopColor: COLORS.border.light
              }
            ]}></View>
          {!userLocation && locationStatus === 'failed' ? (
            <Text
              style={{
                color: COLORS.error.active,
                fontSize: 14,
                textAlign: 'center',
                marginBottom: Responsive.height(8)
              }}>
              Your location is required to {isPunchedIn ? 'punch out' : 'punch in'}. Make sure
              location is switched on, step outside or near a window if you can, then tap Retry.
            </Text>
          ) : null}
          {(() => {
            const punchDisabled = isCheckingIn || !userLocation;
            return (
              <View style={{ paddingHorizontal: Responsive.width(20) }}>
                <AppButton
                  width="100%"
                  title={isPunchedIn ? 'Punch-Out' : 'Punch-In'}
                  onPress={isPunchedIn ? onPunchOut : onPunchIn}
                  disabled={punchDisabled}
                  loader={isCheckingIn}
                  backgroundColor={isPunchedIn ? COLORS.error.active : COLORS.success.active}
                />
              </View>
            );
          })()}
        </View>
      </View>
    </AppModal>
  );
};

export default PunchModal;
