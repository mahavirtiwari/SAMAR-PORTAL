import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppSettings from '../../../appsettings';
import { Responsive } from '../../assets/theme/Layout';
import { COLORS, FONT_SIZE, FONTS_FAMILY } from '../../assets/theme/Theme';
import Header from '../../components/layout/Header';
import Icons from '../../constants/Icons';
import Images from '../../constants/Images';

// Static copy for the About screen. Keep these neutral/editable — final wording
// should be confirmed with the QCI / SAMAR content team.
const RESPONSIBILITIES = [
  'Allocate Assessment Parameters To Co-Assessors',
  'Conduct Site Assessment And Meetings',
  'Review And Submit The Final Assessment'
];

const AboutSamar = () => {
  return (
    <View style={styles.container}>
      <Header title="About SAMAR" back={true} headerBottomStyle={true} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.inerBx}>
          <View >
            {/* Hero */}
            <View style={styles.hero}>
              <Image source={Images.maintenanceSamar} style={styles.logo} />
              <Text style={styles.heroTitle}>
                System for Advanced Maturity{'\n'}Assessment and Rating
              </Text>
            </View>

            {/* About the System */}
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>About the System</Text>
              <Text style={styles.sectionBody}>
                SAMAR Is A Digital Assessment Platform By The Ministry Of Defence For Evaluating The
                Manufacturing Maturity Of Defence Production Units. It Enables Assessors To Conduct
                Structured, On-Site Evaluations And Submit Standardised Maturity Ratings.
              </Text>
            </View>

            {/* Responsibilities */}
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>Responsibilities</Text>
              <View style={styles.bulletList}>
                {RESPONSIBILITIES.map((item, index) => (
                  <View key={index} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>{'•'}</Text>
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.metaText}>
                Version{' '}
                <Text style={styles.metaValue}>
                  {AppSettings.VERSION_DISPLAY}
                  {AppSettings.COMMIT ? ` (${AppSettings.COMMIT})` : ''}
                </Text>
              </Text>
              <Text style={styles.metaText}>
                Build number <Text style={styles.metaValue}>{AppSettings.VERSION_INTERNAL}</Text>
              </Text>
            </View>

            <View style={styles.logoRow}>
              <Image source={Images.drdo} style={styles.footerLogo} />
              <Image source={Images.government} style={styles.governmentLogo} />
              <Image source={Icons.QCILogo} style={styles.footerLogo} />
            </View>

            <Text style={styles.copyright}>
              © {new Date().getFullYear()}, DRDO, Ministry of Defence, Government of India
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default AboutSamar;

const SLATE = '#8B93A8';
const _ACCENT = '#3D8BFD';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary
  },
  inerBx: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  scrollContent: {
    flexGrow: 1,
     backgroundColor: COLORS.background.primary
  },
  hero: {
    alignItems: 'center',
    paddingTop: Responsive.height(28),
    paddingBottom: Responsive.height(24),
    paddingHorizontal: Responsive.width(24)
  },
  logo: {
    height: Responsive.height(90),
    width: Responsive.width(90),
    resizeMode: 'contain',
    marginBottom: Responsive.height(16)
  },
  heroTitle: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.heading,
    textAlign: 'center',
    lineHeight: Responsive.height(20)
  },
  section: {
    paddingHorizontal: Responsive.width(16),
    paddingTop: Responsive.height(8),
    paddingBottom: Responsive.height(16)
  },
  sectionHeading: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: '#78829D',
    marginBottom: Responsive.height(10)
  },
  sectionBody: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.heading,
    lineHeight: Responsive.height(18)
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  bulletDot: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.heading,
    marginRight: Responsive.width(8),
    lineHeight: Responsive.height(20)
  },
  bulletText: {
    flex: 1,
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.heading,
    lineHeight: Responsive.height(20)
  },
  footer: {
    gap: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Responsive.height(28),
    paddingBottom: Responsive.height(28),
    paddingHorizontal: Responsive.width(16)
  },
  metaText: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs12,
    color: SLATE,
    marginBottom: Responsive.height(4)
  },
  metaValue: {
    color: '#78829D',
    fontSize: 12,
    fontFamily: FONTS_FAMILY.SemiBold600
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Responsive.width(18),
    marginTop: Responsive.height(20),
    marginBottom: Responsive.height(20)
  },
  footerLogo: {
    height: Responsive.height(34),
    width: Responsive.width(34),
    resizeMode: 'contain'
  },
  governmentLogo: {
    height: Responsive.height(34),
    width: Responsive.width(24),
    resizeMode: 'contain'
  },
  copyright: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs12,
    color: '#252F4A',
    textAlign: 'center'
  }
});
