// import React from 'react';
// import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
// import Header from '../../../components/layout/Header';
// import Icons from '../../../constants/Icons';
// import Images from '../../../constants/Images';
// import { COLORS, FONT_SIZE, FONTS_FAMILY } from '../../../assets/theme/Theme';
// import { Responsive } from '../../../assets/theme/Layout';

// /**
//  * Support — UI only.
//  * Design ported from the QCI Assessor app. Content is static; the contact rows
//  * are display-only (no mailto/tel linking or other side effects).
//  */

// const SupportCard = ({ icon, title, content }) => (
//   <View style={styles.supportCard}>
//     <Image source={icon} style={styles.icon} />
//     <View style={styles.cardTextContainer}>
//       <Text style={styles.cardTitle}>{title}</Text>
//       <Text style={styles.cardEmail}>{content}</Text>
//     </View>
//   </View>
// );

// const Support = () => {
//   return (
//     <View style={styles.container}>
//       <Header title={'Help & Support'} back={true} headerBottomStyle={true} />
//       <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
//         <View style={styles.innerContainer}>
//           <Image source={Images.assist} style={styles.supportImage} />
//           <View style={styles.headingContainer}>
//             <Text style={styles.headingText}>How can we assist you?</Text>
//             <Text style={styles.subText}>
//               Let us help you find answers and resolve{'\n'}your queries quickly.
//             </Text>
//           </View>
//           <View style={styles.cardWrapper}>
//             <SupportCard icon={Icons.email} title="EMAIL SUPPORT" content="samar@qcin.org" />
//             <SupportCard icon={Icons.phone} title="CALL US" content="+91-9311412838" />
//           </View>
//         </View>
//       </ScrollView>
//     </View>
//   );
// };

// export default Support;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: COLORS.background.primary
//   },
//   scrollContent: {
//     flexGrow: 1
//   },
//   innerContainer: {
//     backgroundColor: COLORS.background.primary,
//     alignItems: 'center',
//     paddingTop: 10,
//     paddingBottom: 20,
//     paddingHorizontal: 16
//   },
//   supportImage: {
//     alignSelf: 'center',
//     height: Responsive.height(120),
//     width: Responsive.width(215),
//     resizeMode: 'contain',
//     marginBottom: Responsive.height(20)
//   },
//   headingContainer: {
//     alignItems: 'center'
//   },
//   headingText: {
//     fontFamily: FONTS_FAMILY.SemiBold600,
//     fontSize: FONT_SIZE.fs18,
//     color: COLORS.text.heading
//   },
//   subText: {
//     fontFamily: FONTS_FAMILY.Medium500,
//     fontSize: FONT_SIZE.fs12,
//     color: COLORS.text.primary,
//     textAlign: 'center',
//     paddingTop: Responsive.height(4)
//   },
//   cardWrapper: {
//     paddingTop: 40,
//     width: '100%'
//   },
//   supportCard: {
//     width: '100%',
//     paddingHorizontal: 15,
//     marginBottom: 10,
//     paddingVertical: 15,
//     borderWidth: 1,
//     borderColor: COLORS.border.regular,
//     borderRadius: 10,
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: COLORS.background.primary
//   },
//   icon: {
//     width: 40,
//     height: 40,
//     resizeMode: 'contain'
//   },
//   cardTextContainer: {
//     flex: 1,
//     flexDirection: 'column',
//     justifyContent: 'space-between',
//     paddingLeft: 20
//   },
//   cardTitle: {
//     fontFamily: FONTS_FAMILY.Bold700,
//     fontSize: FONT_SIZE.fs12,
//     color: COLORS.text.primary
//   },
//   cardEmail: {
//     fontFamily: FONTS_FAMILY.Medium500,
//     fontSize: FONT_SIZE.fs14,
//     color: COLORS.primary.main,
//     paddingTop: Responsive.height(5)
//   }
// });

import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  LayoutAnimation,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Responsive } from '../../../assets/theme/Layout';
import { commonStyles } from '../../../assets/theme/Styles';
import { COLORS, FONT_SIZE, FONTS_FAMILY } from '../../../assets/theme/Theme';
import Header from '../../../components/layout/Header';
import Icons from '../../../constants/Icons';
import Images from '../../../constants/Images';

// Enable LayoutAnimation on Android (no-op on iOS where it's on by default)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const _FAQS = [
  {
    question: 'How Do I Work Offline During An Assessment?',
    answer:
      'SAMAR automatically switches to offline mode when no network is detected. All scoring, parameter notes, and evidence entries are saved locally on your device. Once you’re back online, tap the sync icon in the top bar to push your changes to the server. No data is lost during the switch.',
  },
  {
    question: 'Can I Edit Submitted Report?',
    answer:
      'Once a report is submitted it is locked for editing. If a correction is needed, contact your lead assessor or SAMAR support to request a reopen.',
  },
  {
    question: 'How Do I Add A Co-Assessor Mid-Assessment?',
    answer:
      'Open the assessment, go to the team section, and use Add Co-Assessor. Assign the parameters they will handle. The co-assessor will see the assessment in their app once synced.',
  },
  {
    question: 'Where Do I View My Certification Scope?',
    answer:
      'Your certification scope is listed on the assessment details screen under the Scope section, along with the products and parameters included for the audit.',
  },
];

const SupportCard = ({ icon, title, content, onPress }) => (
  <View style={styles.supportCard}>
    <Image source={icon} style={styles.icon} />
    <View style={styles.cardTextContainer}>
      <Text style={[commonStyles.FontFamily_SemiBold600, styles.cardTitle]}>{title}</Text>
      <TouchableOpacity activeOpacity={0.6} onPress={onPress}>
        <Text style={[commonStyles.bodyMedium500, styles.cardEmail]}>{content}</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const Support = () => {
  const _navigation = useNavigation();
  const [visibleShadow, setVisibleShadow] = useState(false);
  // First FAQ open by default (matches the design); only one item open at a time.
  const [_openFaq, setOpenFaq] = useState(0);

  const _toggleFaq = useCallback(index => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenFaq(prev => (prev === index ? -1 : index));
  }, []);
  const scrollY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Smoothly animate header visibility based on scroll position
  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      const show = value >= 100;
      setVisibleShadow(show);
    });
    return () => {
      scrollY.removeListener(listenerId);
    };
  }, [scrollY]);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visibleShadow ? 1 : 0,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [visibleShadow]);
  const handleEmailSupportPress = useCallback(() => {
    Linking.openURL('mailto:samar@qcin.org');
  }, []);

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false,
  });

  const handleCallPress = useCallback(() => {
    Linking.openURL('tel:+91-9311412838');
  }, []);

  return (
    <View style={styles.container}>
      <Header title={'Help & Support'} noback={!true} headerBottomStyle={true} back={true} />
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}>
        <View style={styles.innerContainer}>
          <Image source={Images.assist} style={styles.supportImage} />
          <View style={styles.headingContainer}>
            <Text style={[commonStyles.h4, styles.headingText]}>How can we assist you?</Text>
            <Text style={[commonStyles.bodySmall500, styles.subText]}>
              Let us help you find answers and resolve{'\n'}your queries quickly.
            </Text>
          </View>
          <View style={styles.cardWrapper}>
            <SupportCard
              icon={Icons.email}
              title="EMAIL SUPPORT"
              content="samar@qcin.org"
              onPress={handleEmailSupportPress}
            />
            <SupportCard
              icon={Icons.phone}
              title="CALL US"
              content="+91-9311412838"
              onPress={handleCallPress}
              style={styles.callCard}
            />
          </View>
        </View>

       
      </Animated.ScrollView>
    </View>
  );
};

export default Support;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  innerContainer: {
    backgroundColor: COLORS.white,
    alignItems: 'center',
    paddingTop: Responsive.height(10),
    paddingBottom: Responsive.height(20),
    paddingHorizontal: Responsive.width(16),
  },
  iconContainer: {
    width: Responsive.width(35),
    height: Responsive.height(40),
  },
  supportImage: {
    alignSelf: 'center',
    height: Responsive.height(120),
    width: Responsive.width(215),
    resizeMode: 'contain',
    marginBottom: Responsive.height(20),
  },
  imageContainer: {
    width: '100%',
  },
  headingContainer: {
    alignItems: 'center',
  },
  headingText: {
    color: COLORS.darkBlack,
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs18,
  },
  subText: {
    color: COLORS.text.subHeading,
    textAlign: 'center',
    fontSize: FONT_SIZE.fs12,
    paddingTop: Responsive.height(4),
  },
  cardWrapper: {
    paddingTop: Responsive.height(30),
    width: '100%',
  },
  supportCard: {
    width: '100%',
    paddingHorizontal: Responsive.width(15),
    marginBottom: Responsive.width(10),
    paddingVertical: Responsive.height(15),
    borderWidth: 1,
    borderColor: '#EBEDF3',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  callCard: {
    marginTop: Responsive.height(10),
  },
  icon: {
    width: Responsive.width(40),
    height: Responsive.height(40),
    resizeMode: 'contain',
  },
  cardTextContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingLeft: Responsive.width(20),
  },
  cardTitle: {
    color: COLORS.regularBlack,
    fontSize: FONT_SIZE.fs12,
  },
  cardEmail: {
    color: '#3D8BFD',
    paddingTop: Responsive.height(5),
  },
  itSupportContainer: {
    backgroundColor: COLORS.white,
    paddingVertical: Responsive.height(15),
    paddingHorizontal: Responsive.width(16),
    borderTopWidth: 4,
    borderColor: '#ebedf3',
    marginBottom: 100,
  },
  faqHeading: {
    color: COLORS.darkBlack,
    fontSize: FONT_SIZE.fs18,
    marginBottom: Responsive.height(6),
  },
  accordionBx: {
    width: '100%',
  },

  faqItemLast: {
    borderBottomWidth: 0,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    flex: 1,
    color: '#071437',
    fontSize: FONT_SIZE.fs12,
    fontFamily: FONTS_FAMILY.SemiBold600,
    paddingRight: Responsive.width(12),
  },
  faqArrow: {
    width: Responsive.width(16),
    height: Responsive.height(16),
    resizeMode: 'contain',
    tintColor: COLORS.text.subHeading,
  },
  faqArrowActive: {
    tintColor: '#3D8BFD',
  },
  faqAnswer: {
    color: '#252F4A',
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs12,
    lineHeight: Responsive.height(16),
    marginTop: Responsive.height(10),
  },
  itSupportTextBlock: {
    flex: 1,
    paddingRight: Responsive.width(30),
  },
  itTitle: {
    color: COLORS.darkBlack,
  },
  itDescription: {
    color: COLORS.text.subHeading,
    paddingTop: Responsive.height(5),
  },
  itEmail: {
    color: COLORS.text.primary,
  },
  itImage: {
    height: Responsive.height(50),
    width: Responsive.width(50),
    resizeMode: 'contain',
  },
  footerContainer: {
    marginTop: Responsive.height(4),
    backgroundColor: COLORS.white,
    paddingTop: Responsive.height(40),
    paddingLeft: Responsive.width(16),
    paddingRight: Responsive.width(20),
    alignItems: 'center',
    flex: 1,
    paddingBottom: Responsive.height(30),
  },
  footerLogo: {
    height: Responsive.height(60),
    width: Responsive.width(60),
    resizeMode: 'contain',
    paddingBottom: Responsive.height(30),
  },
  footerTextContainer: {
    paddingTop: Responsive.height(16),
    // backgroundColor:"red"
  },
  footerTitle: {
    color: '#32378D',
  },
  footerSubtitle: {
    color: COLORS.regularBlack,
    paddingTop: Responsive.height(2),
    textAlign: 'center',
  },
  reportIssueContainer: {
    borderWidth: 1,
    borderColor: COLORS.borderColor,
    borderRadius: 10,
    paddingVertical: Responsive.height(15),
    paddingHorizontal: Responsive.width(15),
    marginTop: Responsive.height(14),
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Responsive.height(10),
  },
  alertIcon: {
    height: Responsive.height(16),
    width: Responsive.width(16),
    marginRight: Responsive.width(6),
    resizeMode: 'contain',
  },
  reportContent: { ...commonStyles.twelveGilroy500, color: COLORS.lightBlack },
  flexRow: { flexDirection: 'row', paddingTop: Responsive.height(3) },
  dot: {
    height: Responsive.height(3),
    width: Responsive.width(3),
    borderRadius: 50,
    backgroundColor: COLORS.lightBlack,
    marginRight: Responsive.width(6),
    marginTop: Responsive.height(5),
  },
  redRightArrow: {
    width: Responsive.width(12),
    height: Responsive.height(12),
    resizeMode: 'contain',
  },
  footerSection: {
    alignSelf: 'center',
    paddingTop: Responsive.height(150),
    gap: Responsive.width(15),
  },
  samar: {
    height: Responsive.height(32),
    width: Responsive.width(32),
    resizeMode: 'contain',
  },
  government: {
    height: Responsive.height(32),
    width: Responsive.width(21),
    resizeMode: 'contain',
  },
  drdo: {
    height: Responsive.height(32),
    width: Responsive.width(32),
    resizeMode: 'contain',
  },
  reportComplaintBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Responsive.height(9),
    paddingHorizontal: Responsive.width(20),
    backgroundColor: '#FBEBEC',
    marginTop: Responsive.height(16),
    borderRadius: 4,
  },
});
