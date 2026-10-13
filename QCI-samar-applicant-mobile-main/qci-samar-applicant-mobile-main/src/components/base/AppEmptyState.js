import { Image, StyleSheet, Text, View } from 'react-native';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles, layout } from '../../assets/theme/Styles';
import { COLORS, FONT_SIZE } from '../../assets/theme/Theme';
import AppButton from './AppButton';

const AppEmptyState = ({
  EmptyImage,
  heading,
  subHeading,
  imageContainerStyle,
  imagesize,
  button,
  onPress,
  content,
  backgroundColor = COLORS.background.secondary,
}) => {
  return (
    <View style={[styles.fullScreen, { backgroundColor }]}>
      <View style={[layout.center, layout.fill]}>
        <View style={[styles.imageContainer, imageContainerStyle]}>
          <Image source={EmptyImage} style={[styles.image, imagesize]} />
        </View>
        {heading && (
          <View style={{ paddingTop: Responsive.height(30) }}>
            <Text
              style={[
                commonStyles.FontFamily_SemiBold600,
                { color: COLORS.text.heading, fontSize: FONT_SIZE.fs20 },
              ]}>
              {heading}
            </Text>
          </View>
        )}
        {subHeading && (
          <View
            style={{
              paddingTop: Responsive.height(8),
              paddingHorizontal: Responsive.width(20),
            }}>
            <Text
              style={[
                commonStyles.FontFamily_Medium500,
                { color: COLORS.text.tertiary, fontSize: FONT_SIZE.fs12, textAlign: 'center' },
              ]}>
              {subHeading}
            </Text>
          </View>
        )}
        {button && (
          <View style={styles.buttonContainer}>
            <AppButton
              width={'100%'}
              title={content}
              variant="primary"
              size="small"
              onPress={onPress}
            />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
  },
  image: {
    height: Responsive.height(210),
    resizeMode: 'contain',
    width: Responsive.width(250),
  },
  buttonContainer: {
    marginTop: Responsive.height(30),
    width: '50%',
  },
});

export default AppEmptyState;
