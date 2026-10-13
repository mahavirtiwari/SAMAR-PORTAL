import { Image, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../assets/theme/Layout';
import { COLORS, FONT_SIZE } from '../../assets/theme/Theme';
import AppButton from '../../components/base/AppButton';
import Images from '../../constants/Images';
import { clearMaintenanceMode } from '../../redux/slices/accountSlice';

const Maintenance = () => {
  const dispatch = useDispatch();
  const { maintenanceMessage } = useSelector((state) => state.account);

  const handleRetry = () => {
    dispatch(clearMaintenanceMode());
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image source={Images.maintenanceSamar} style={styles.logo} resizeMode="contain" />
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>🔧</Text>
        </View>
        <Text style={styles.title}>System Under Maintenance</Text>
        <Text style={styles.message}>
          {maintenanceMessage || 'System is currently under maintenance. Please try again later.'}
        </Text>
        <View style={styles.buttonContainer}>
          <AppButton title="Retry" onPress={handleRetry} style={styles.retryButton} />
        </View>
      </View>
      <View style={styles.footer}>
        <Image source={Images.drdo} style={styles.drdo} />
        <View style={styles.logoSeparator} />
        <Image source={Images.government} style={styles.government} />
        <View style={styles.logoSeparator} />
        <Image source={Images.qci} style={styles.qci} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    justifyContent: 'space-between'
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Responsive.width(8)
  },
  logo: {
    width: Responsive.width(120),
    height: Responsive.width(120),
    marginBottom: Responsive.height(24)
  },
  iconContainer: {
    width: Responsive.width(25),
    height: Responsive.width(25),
    borderRadius: Responsive.width(12.5),
    backgroundColor: COLORS.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Responsive.height(3)
  },
  iconText: {
    fontSize: FONT_SIZE.xxxl * 2
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: Responsive.height(2)
  },
  message: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Responsive.width(5),
    marginBottom: Responsive.height(4)
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: Responsive.width(10)
  },
  retryButton: {
    width: '100%'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Responsive.width(6),
    paddingBottom: Responsive.height(40)
  },
  government: {
    height: Responsive.height(32),
    width: Responsive.width(21),
    resizeMode: 'contain'
  },
  drdo: {
    height: Responsive.height(32),
    width: Responsive.width(32),
    resizeMode: 'contain'
  },
  qci: {
    height: Responsive.height(32),
    width: Responsive.width(32),
    resizeMode: 'contain'
  },
  logoSeparator: {
    width: 1,
    height: Responsive.height(24),
    backgroundColor: COLORS.border.light
  }
});

export default Maintenance;
