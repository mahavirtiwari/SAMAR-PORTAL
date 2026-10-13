import FastImage from '@d11/react-native-fast-image';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native'; // Ensure correct import for Image
import { Responsive } from '../../assets/theme/Layout';
import { layout } from '../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONTS_FAMILY } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';

export default function AppThumbnailView({
  nameOrPhoto,
  backgroundColor,
  textColor,
  dimension,
  borderRadiusCus,
  typography,
  profileDetailsId,
  firstNameInitial,
  lastNameInitial,
  OutermostContainerStyle,
  nameInitials,
  group,
  project,
  status,
  ReleaseStatus
}) {
  const navigation = useNavigation();
  const [imageKey, setImageKey] = useState(0);
  const [_authHeaders, _setAuthHeaders] = useState(null);

  // const baseURL = AppSettings.BASE_URL;

  // const fetchToken = useCallback(async () => {
  //   try {
  //     const token = await getToken('accessToken');
  //     if (token?.token) {
  //       setAuthHeaders({
  //         Authorization: `Bearer ${token.token}`
  //       });
  //     }
  //   } catch (error) {
  //     Logger.error('Error retrieving token:', error);
  //   }
  // }, []);

  // useEffect(() => {
  //   fetchToken();
  // }, [fetchToken]);
  // const imageSource = useMemo(() => {
  //   if (group) {
  //     return `${baseURL}/WeborityTaskGroup/DownloadTaskgroupImage/${profileDetailsId}/${nameOrPhoto}`;
  //   } else if (project) {
  //     return `${baseURL}/BusinessAnalyst/EngineeringProject/GetProjectImage/${profileDetailsId}/${nameOrPhoto}`;
  //   } else {
  //     return `${baseURL}/Webority/GetEmployeeImage/${profileDetailsId}/${nameOrPhoto}`;
  //   }
  // }, [baseURL, group, project, profileDetailsId, nameOrPhoto]);

  // const fetchImageData = useMemo(
  //   () => ({
  //     uri: imageSource,
  //     priority: FastImage.priority.high,
  //     cache: FastImage.cacheControl.immutable,
  //     headers: authHeaders || {}
  //   }),
  //   [imageSource, authHeaders]
  // );

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setImageKey((prevKey) => prevKey + 1);
    });
    return unsubscribe;
  }, [navigation]);
  return (
    <View
      style={[
        layout.row,
        {
          ...OutermostContainerStyle
        }
      ]}>
      {nameOrPhoto ? (
        <View>
          <FastImage
            key={imageKey}
            source={{ uri: nameOrPhoto }}
            style={{ ...styles.profilePicture, ...dimension }}
            resizeMode={FastImage.resizeMode.cover}
          />
          {ReleaseStatus ? (
            !status ? (
              <View style={styles.iconOverlay}>
                <Image source={Icons.PendingSignOff} style={layout.iconSize20} />
              </View>
            ) : (
              <View style={styles.iconOverlay}>
                <Image source={Icons.CompletedSignOff} style={layout.iconSize20} />
              </View>
            )
          ) : null}
        </View>
      ) : (
        <View
          style={{
            ...styles.nameInitialContainer,
            ...backgroundColor,
            ...dimension,
            ...borderRadiusCus
          }}>
          <Text style={{ ...styles.fontStyle, ...typography, ...textColor }}>
            {firstNameInitial}
            {firstNameInitial && lastNameInitial
              ? '' + lastNameInitial
              : lastNameInitial
                ? lastNameInitial
                : null}
            {nameInitials}
          </Text>
          {ReleaseStatus ? (
            !status ? (
              <View style={styles.iconOverlay}>
                <Image source={Icons.PendingSignOff} style={layout.iconSize20} />
              </View>
            ) : (
              <View style={styles.iconOverlay}>
                <Image source={Icons.CompletedSignOff} style={layout.iconSize20} />
              </View>
            )
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fontStyle: {
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: COLORS.text.highlight,
    fontFamily: FONTS_FAMILY.Bold700
  },
  nameInitialContainer: {
    alignItems: 'center',
    height: 100,
    justifyContent: 'center',
    width: 100,
    paddingTop: Responsive.height(0),
    borderRadius: BORDER_RADIUS.circle,
    resizeMode: 'contain'
  },
  profilePicture: {
    borderRadius: BORDER_RADIUS.circle
  },
  iconOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0
  }
});
