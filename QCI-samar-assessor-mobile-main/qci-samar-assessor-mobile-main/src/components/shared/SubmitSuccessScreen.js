import { format } from 'date-fns';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { COLORS, FONT_SIZE } from '../../assets/theme/Theme';

// Full-screen confirmation shown after a successful "Submit Assessment"
// (Complete on Mobile) cutover. Auto-dismisses after `autoCloseMs` (3s) and
// calls onComplete — the caller navigates back. Mirrors CheckInSuccessScreen's
// animation style so the two success moments feel consistent.
const DOTS = [
  { top: '18%', left: '20%', size: 14 },
  { top: '12%', right: '18%', size: 9 },
  { top: '30%', left: '12%', size: 7 },
  { top: '40%', right: '14%', size: 8 },
  { top: '52%', left: '24%', size: 6 },
  { top: '46%', right: '26%', size: 10 }
];

const SubmitSuccessScreen = ({
  visible,
  onComplete,
  applicationNumber,
  startDate,
  endDate,
  autoCloseMs = 3000
}) => {
  const scaleValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;
  const dotAnimations = useRef(DOTS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!visible) {
      scaleValue.setValue(0);
      fadeValue.setValue(0);
      dotAnimations.forEach((anim) => anim.setValue(0));
      return undefined;
    }

    scaleValue.setValue(0);
    fadeValue.setValue(0);
    dotAnimations.forEach((anim) => anim.setValue(0));

    Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 500,
        easing: Easing.bounce,
        useNativeDriver: true
      }),
      Animated.timing(fadeValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }),
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

    const timer = setTimeout(() => {
      onComplete?.();
    }, autoCloseMs);

    return () => {
      clearTimeout(timer);
      scaleValue.stopAnimation();
      fadeValue.stopAnimation();
      dotAnimations.forEach((anim) => anim.stopAnimation());
    };
  }, [visible, onComplete, autoCloseMs, scaleValue, fadeValue, dotAnimations]);

  if (!visible) {
    return null;
  }

  const safeFormat = (value) => {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : format(date, 'd MMM');
  };
  const start = safeFormat(startDate);
  const end = safeFormat(endDate);

  return (
    <View style={styles.container}>
      {/* Mint hero with the animated check + floating dots */}
      <View style={styles.hero}>
        {DOTS.map((dot, index) => {
          const animatedStyle = {
            transform: [
              {
                translateY: dotAnimations[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -16]
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
              outputRange: [0.5, 1, 0.5]
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
        <Animated.View style={[styles.iconOuter, { transform: [{ scale: scaleValue }] }]}>
          <View style={styles.iconInner}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
        </Animated.View>
      </View>
      {/* White body: title, helper text, assessment card */}
      <Animated.View style={[styles.body, { opacity: fadeValue }]}>
        <Text style={styles.title}>Submitted Successfully!</Text>
        <Text style={styles.subtitle}>
          Kindly Login to Web portal to Review & Submit Assessment for Quality Check.
        </Text>
        {!!applicationNumber && (
          <View style={styles.card}>
            <Text style={styles.applicationNumber}>{applicationNumber}</Text>
            {!!(start && end) && (
              <View style={styles.dateRow}>
                <Text style={styles.dateText}>{start}</Text>
                <View style={styles.dateDivider} />
                <Text style={styles.dateText}>{end}</Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background.primary,
    zIndex: 1000
  },
  hero: {
    height: '42%',
    backgroundColor: COLORS.success.light,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  floatingDot: {
    position: 'absolute',
    backgroundColor: COLORS.success.primary,
    zIndex: 1
  },
  iconOuter: {
    width: Responsive.width(96),
    height: Responsive.width(96),
    borderRadius: Responsive.width(48),
    backgroundColor: COLORS.success.clarity,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconInner: {
    width: Responsive.width(64),
    height: Responsive.width(64),
    borderRadius: Responsive.width(32),
    backgroundColor: COLORS.success.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkIcon: {
    fontSize: FONT_SIZE.fs28,
    color: COLORS.text.white,
    fontWeight: 'bold'
  },
  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Responsive.width(32),
    paddingTop: Responsive.height(40)
  },
  title: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs24,
    color: COLORS.success.active,
    textAlign: 'center'
  },
  subtitle: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: Responsive.height(12),
    lineHeight: Responsive.height(20)
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.background.secondary,
    borderRadius: 12,
    paddingVertical: Responsive.height(20),
    paddingHorizontal: Responsive.width(20),
    marginTop: Responsive.height(40),
    alignItems: 'center'
  },
  applicationNumber: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs18,
    color: COLORS.text.primary,
    textAlign: 'center'
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Responsive.height(8)
  },
  dateText: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.secondary
  },
  dateDivider: {
    width: Responsive.width(40),
    height: 1,
    borderRadius: 1,
    backgroundColor: COLORS.border.regular,
    marginHorizontal: Responsive.width(10)
  }
});

export default SubmitSuccessScreen;
