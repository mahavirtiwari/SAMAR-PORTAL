import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { COLORS, FONT_SIZE, SPACING } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';
import AppButton from '../base/AppButton';

const AppCommonModal = ({
  showmodal,
  title,
  subTitle,
  onPress,
  imgsrc,
  twoButtonModal,
  leftButtonColor,
  leftButtonText,
  rightButtonText,
  rightButtonStyle,
  LeftonPress,
  onebutton = true,
  variant = 'primary',
  leftvariant = 'outline',
  LeftbuttonTextColor
}) => {
  return (
    <Modal statusBarTranslucent animationType="fade" transparent={true} visible={showmodal}>
      <View style={styles.absolute} />
      <View style={styles.centeredView}>
        <View style={[styles.modalView, {}]}>
          <View style={[styles.imgView]}>
            {imgsrc ? (
              <Image source={imgsrc} style={styles.imgStyle} />
            ) : (
              <Image source={Icons.success} style={styles.succGreenSmalimg} />
            )}
          </View>
          <View style={[styles.messagesCont]}>
            {title ? (
              <Text style={[commonStyles.FontFamily_SemiBold600, styles.message1]}>{title}</Text>
            ) : null}
            {subTitle ? (
              <Text
                style={[
                  commonStyles.FontFamily_Medium500,
                  commonStyles.textAlign,
                  { color: COLORS.text.tertiary, fontSize: FONT_SIZE.fs14 }
                ]}>
                {subTitle}
              </Text>
            ) : null}
            {!twoButtonModal ? null : (
              <View
                style={[
                  commonStyles.rowCenter,
                  {
                    paddingTop: Responsive.height(32),
                    gap: SPACING.sp14
                  }
                ]}>
                {onebutton && (
                  <View style={styles.width40Percent}>
                    <AppButton
                      title={leftButtonText}
                      textColor={LeftbuttonTextColor}
                      size="medium"
                      variant={leftvariant}
                      onPress={LeftonPress}
                      backgroundColor={leftButtonColor}
                    />
                  </View>
                )}
                <View style={styles.width40Percent}>
                  <AppButton
                    title={rightButtonText}
                    size="medium"
                    variant={variant}
                    onPress={onPress}
                    backgroundColor={rightButtonStyle}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default AppCommonModal;
const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Responsive.width(20)
  },
  modalView: {
    backgroundColor: COLORS.background.primary,
    paddingHorizontal: Responsive.width(24),
    paddingVertical: Responsive.height(20),
    borderRadius: 20,
    width: '100%'
  },
  imgView: {
    alignSelf: 'center',
    paddingTop: Responsive.height(20)
  },
  imgStyle: {
    width: Responsive.width(110),
    height: Responsive.height(110),
    resizeMode: 'contain'
  },
  succGreenSmalimg: {
    width: Responsive.width(154),
    height: Responsive.height(145),
    resizeMode: 'contain'
  },
  message1: {
    textAlign: 'center',
    marginBottom: Responsive.height(6),
    color: COLORS.text.heading,
    fontSize: FONT_SIZE.fs20
  },
  messagesCont: {
    marginTop: Responsive.height(30)
  },
  absolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.background.modalOverlay
  },
  width40Percent: {
    width: '50%'
  }
});
