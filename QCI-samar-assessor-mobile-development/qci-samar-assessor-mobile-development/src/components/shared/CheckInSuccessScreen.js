import { useEffect } from 'react';
import { Animated, Dimensions, Easing, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { COLORS, FONT_SIZE, FONTS_FAMILY } from '../../assets/theme/Theme';

const { width: screenWidth } = Dimensions.get('window');

const CheckInSuccessScreen = ({
  visible,
  onComplete,
  location = 'Location not available',
  time = '09:20 AM'
}) => {
  const { attendanceStatus } = useSelector((state) => state.assessment);
  const scaleValue = new Animated.Value(0);
  const fadeValue = new Animated.Value(0);
  const dotAnimations = [
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0)
  ];

  useEffect(() => {
    if (visible) {
      // Reset animations first
      scaleValue.setValue(0);
      fadeValue.setValue(0);
      dotAnimations.forEach((anim) => anim.setValue(0));

      // Start animations
      Animated.parallel([
        // Main success icon animation
        Animated.sequence([
          Animated.timing(scaleValue, {
            toValue: 1,
            duration: 500,
            easing: Easing.bounce,
            useNativeDriver: true
          })
        ]),
        // Fade in animation
        Animated.timing(fadeValue, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }),
        // Floating dots animation
        Animated.stagger(
          100,
          dotAnimations.map((anim) =>
            Animated.loop(
              Animated.sequence([
                Animated.timing(anim, {
                  toValue: 1,
                  duration: 2000,
                  easing: Easing.inOut(Easing.sin),
                  useNativeDriver: true
                }),
                Animated.timing(anim, {
                  toValue: 0,
                  duration: 2000,
                  easing: Easing.inOut(Easing.sin),
                  useNativeDriver: true
                })
              ])
            )
          )
        )
      ]).start();

      // Auto close after 2 seconds
      const timer = setTimeout(() => {
        onComplete();
      }, 2000);

      return () => {
        clearTimeout(timer);
        // Stop all animations
        scaleValue.stopAnimation();
        fadeValue.stopAnimation();
        dotAnimations.forEach((anim) => anim.stopAnimation());
      };
    } else {
      // Reset animations
      scaleValue.setValue(0);
      fadeValue.setValue(0);
      dotAnimations.forEach((anim) => anim.setValue(0));
    }
  }, [visible, onComplete]);

  if (!visible) {
    return null;
  }

  // Dot positions - scattered around the success icon across full screen height
  const dotPositions = [
    { top: '10%', left: '15%', size: 15 },
    { top: '15%', right: '20%', size: 10 },
    { top: '25%', left: '10%', size: 8 },
    { top: '35%', right: '15%', size: 6 },
    { top: '20%', left: '20%', size: 6 },
    { top: '35%', right: '25%', size: 8 }
  ];

  return (
    <View style={styles.container}>
      {/* Floating dots - positioned relative to full screen */}
      {dotPositions.map((dot, index) => {
        const animatedStyle = {
          transform: [
            {
              translateY: dotAnimations[index].interpolate({
                inputRange: [0, 1],
                outputRange: [0, -20]
              })
            },
            {
              scale: dotAnimations[index].interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.8, 1.2, 0.8]
              })
            }
          ],
          opacity: dotAnimations[index].interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.6, 1, 0.6]
          })
        };

        return (
          <Animated.View
            key={index}
            style={[
              styles.floatingDot,
              {
                ...dot,
                width: dot.size,
                height: dot.size,
                borderRadius: dot.size / 2
              },
              animatedStyle
            ]}
          />
        );
      })}

      <Animated.View style={[styles.content, { opacity: fadeValue }]}>
        {/* Main success icon */}
        <Animated.View
          style={[styles.successIconContainer, { transform: [{ scale: scaleValue }] }]}>
          <View style={styles.successIconOuter}>
            <View style={styles.successIconMiddle}>
              <View style={styles.successIconInner}>
                <Text style={styles.checkIcon}>✓</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Success text */}
        <Text style={styles.successTitle}>
          Successfully {!attendanceStatus?.isPunchedIn ? 'Punch Out' : 'Punch In'}!
        </Text>

        {/* Location icon */}

        {/* Location and time */}

        <View style={{}}>
          {/* <View
            style={{
              position: 'absolute',
              top: Responsive.height(15),
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
            <Text style={styles.locationText}>{location}</Text>
            <Text style={styles.timeText}>{time}</Text>
          </View> */}
          <View style={styles.timeIndicator}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text
                style={{
                  fontSize: 14,
                  color: COLORS.text.primary,
                  fontFamily: FONTS_FAMILY.SemiBold600
                }}>
                {time}
              </Text>
            </View>
          </View>
          <View style={[commonStyles.row, { alignItems: 'center', marginTop: 4 }]}>
            <Text style={{ color: COLORS.text.primary, fontSize: 14 }}>{location}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = {
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background.primary,
    zIndex: 1000,
    ...commonStyles.center
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  floatingDot: {
    position: 'absolute',
    backgroundColor: COLORS.success.active,
    borderRadius: 50,
    zIndex: 2
  },
  successIconContainer: {
    marginBottom: Responsive.height(32)
  },
  successIconOuter: {
    width: Responsive.width(120),
    height: Responsive.width(120),
    borderRadius: Responsive.width(60),
    backgroundColor: COLORS.success.light,
    ...commonStyles.center
  },
  successIconMiddle: {
    width: Responsive.width(90),
    height: Responsive.width(90),
    borderRadius: Responsive.width(45),
    backgroundColor: COLORS.success.clarity,
    ...commonStyles.center
  },
  successIconInner: {
    width: Responsive.width(60),
    height: Responsive.width(60),
    borderRadius: Responsive.width(30),
    backgroundColor: COLORS.success.active,
    ...commonStyles.center
  },
  checkIcon: {
    fontSize: FONT_SIZE.fs24,
    color: COLORS.text.white,
    fontWeight: 'bold'
  },
  successTitle: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs18,
    color: COLORS.text.heading,
    textAlign: 'center',
    marginBottom: Responsive.height(50)
  },
  locationContainer: {
    width: Responsive.width(45),
    height: Responsive.width(45),
    borderRadius: Responsive.width(30),
    backgroundColor: COLORS.primary.subtle,
    ...commonStyles.center,
    marginBottom: Responsive.height(12)
  },
  locationIconImage: {
    width: Responsive.width(25),
    height: Responsive.height(25),
    tintColor: COLORS.primary.main
  },
  locationTimeContainer: {
    height: Responsive.height(80),
    width: screenWidth * 0.8, // Use 80% of screen width for better appearance
    resizeMode: 'stretch' // Ensure image stretches to full width
  },
  locationText: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: Responsive.height(4)
  },
  timeText: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.heading,
    textAlign: 'center'
  }
};

export default CheckInSuccessScreen;
