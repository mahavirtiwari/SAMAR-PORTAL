import PropTypes from 'prop-types';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { Responsive } from '../../assets/theme/Layout';
import Icons from '../../constants/Icons';

/**
 * Reusable Screen Wrapper Component
 * Provides consistent background and bottom logo across all screens
 * Can be used like ScrollView - wrap your screen content inside
 */
const ScreenWrapper = ({
  children,
  scrollable = true,
  backgroundColor = '#F5F6FA',
  showLogo = false,
  logoOpacity = 1,
  logoSize = 120,
  contentContainerStyle,
  paddingHorizontal = Responsive.width(0),
  paddingVertical = Responsive.height(0),
  paddingTop = Responsive.height(0),
  style,
  ...props
}) => {
  const Container = scrollable ? ScrollView : View;

  const containerProps = scrollable
    ? {
        contentContainerStyle: [styles.scrollContent, contentContainerStyle],
        showsVerticalScrollIndicator: false,
        showsHorizontalScrollIndicator: false,
        ...props
      }
    : {
        style: [styles.container, contentContainerStyle],
        ...props
      };

  return (
    <View style={[styles.wrapper, { backgroundColor, paddingHorizontal, paddingVertical }, style]}>
      <Container {...containerProps}>{children}</Container>

      {/* Bottom Logo */}
      {showLogo && (
        <View style={styles.logoContainer}>
          <Image
            source={Icons.samarLogoOne}
            style={[
              styles.logo,
              {
                width: logoSize,
                height: logoSize,
                opacity: logoOpacity
              }
            ]}
            resizeMode="contain"
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: 'relative'
  },
  container: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Responsive.height(120) // Space for logo
  },
  logoContainer: {
    position: 'absolute',
    bottom: Responsive.height(150),
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logo: {}
});

ScreenWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  scrollable: PropTypes.bool,
  backgroundColor: PropTypes.string,
  showLogo: PropTypes.bool,
  logoOpacity: PropTypes.number,
  logoSize: PropTypes.number,
  contentContainerStyle: PropTypes.object,
  style: PropTypes.object
};

export default ScreenWrapper;
