// Card skeleton for Home assessments (matches real card layout)
export const HomeSkeletonCard = () => (
  <View
    style={{
      backgroundColor: COLORS.background.primary,
      borderRadius: 12,
      marginBottom: 12,
      padding: 12
    }}>
    <AppSkeletonPlaceholder>
      {/* Header Row: Icon + Details */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 }}>
        <AppSkeletonPlaceholder.Item width={40} height={42} borderRadius={10} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <AppSkeletonPlaceholder.Item
            width={120}
            height={16}
            borderRadius={4}
            style={{ marginBottom: 6 }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AppSkeletonPlaceholder.Item
              width={14}
              height={14}
              borderRadius={4}
              style={{ marginRight: 6 }}
            />
            <AppSkeletonPlaceholder.Item width={100} height={12} borderRadius={4} />
          </View>
        </View>
      </View>
      {/* Progress Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <AppSkeletonPlaceholder.Item width={'90%'} height={10} borderRadius={4} />
        <AppSkeletonPlaceholder.Item
          width={24}
          height={12}
          borderRadius={4}
          style={{ marginLeft: 12 }}
        />
      </View>
      {/* Footer Row: Date + Button */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppSkeletonPlaceholder.Item
            width={14}
            height={14}
            borderRadius={4}
            style={{ marginRight: 6 }}
          />
          <AppSkeletonPlaceholder.Item width={120} height={12} borderRadius={4} />
        </View>
        <AppSkeletonPlaceholder.Item width={100} height={14} borderRadius={8} />
      </View>
    </AppSkeletonPlaceholder>
  </View>
);

import { Platform, StyleSheet, View } from 'react-native';
import { COLORS } from '../../assets/theme/Theme';
import AppSkeletonPlaceholder from '../base/AppSkeletonPlaceholder';

const DashboardSkeleton = () => {
  return (
    // <AppSkeletonPlaceholder>
    <View style={[styles.container]}>
      {/* Header */}
      <View style={[styles.headerRow]}>
        <AppSkeletonPlaceholder>
          <AppSkeletonPlaceholder.Item width={40} height={40} borderRadius={20} />
        </AppSkeletonPlaceholder>
        <AppSkeletonPlaceholder>
          <View style={{ marginLeft: 12 }}>
            <AppSkeletonPlaceholder.Item width={120} height={16} />
            <AppSkeletonPlaceholder.Item width={160} height={12} style={{ marginTop: 6 }} />
          </View>
        </AppSkeletonPlaceholder>
      </View>
      {/* Stat Cards */}
      {/* <View style={styles.statRow}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.statCard}>
            <AppSkeletonPlaceholder>
              <AppSkeletonPlaceholder.Item width={30} height={30} borderRadius={8} />
              <AppSkeletonPlaceholder.Item width={40} height={16} style={{ marginTop: 8 }} />
              <AppSkeletonPlaceholder.Item width={70} height={12} style={{ marginTop: 6 }} />
            </AppSkeletonPlaceholder>
          </View>
        ))}
      </View> */}
      {/* In Progress Title */}
      <AppSkeletonPlaceholder>
        <AppSkeletonPlaceholder.Item width={180} height={16} style={{ marginTop: 20 }} />
      </AppSkeletonPlaceholder>
      {[1, 2].map((i) => (
        <View key={i} style={styles.card}>
          <AppSkeletonPlaceholder>
            <AppSkeletonPlaceholder.Item width={140} height={16} />
            <AppSkeletonPlaceholder.Item width={180} height={12} style={{ marginTop: 6 }} />
            <AppSkeletonPlaceholder.Item width="100%" height={10} style={{ marginTop: 12 }} />
            <AppSkeletonPlaceholder.Item width={120} height={12} style={{ marginTop: 10 }} />
          </AppSkeletonPlaceholder>
        </View>
      ))}
      <AppSkeletonPlaceholder>
        <AppSkeletonPlaceholder.Item width={180} height={16} style={{ marginTop: 20 }} />
      </AppSkeletonPlaceholder>{' '}
      {[1, 2].map((i) => (
        <View key={i} style={styles.card}>
          <AppSkeletonPlaceholder>
            <AppSkeletonPlaceholder.Item width={150} height={16} />
            <AppSkeletonPlaceholder.Item width={180} height={12} style={{ marginTop: 6 }} />
            <AppSkeletonPlaceholder.Item width={120} height={14} style={{ marginTop: 12 }} />
          </AppSkeletonPlaceholder>
        </View>
      ))}
    </View>
    // </AppSkeletonPlaceholder>
  );
};

export default DashboardSkeleton;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 40
    // backgroundColor: 'pink',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20
  },
  statCard: {
    width: '30%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background.primary // 👈 add this
  },
  card: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.background.primary // 👈 add this
  }
});
