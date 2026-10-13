import { Image, Text, View } from 'react-native';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';

// Corner badge that tells the user whether a captured photo is safely on the
// server or still local. It's the per-image counterpart to the global header
// sync button: 'synced' = uploaded, 'pending' = queued/awaiting upload,
// 'failed' = the upload gave up (retry-exhausted or server-rejected). The state
// is derived from the outbox status by the capture screens (see outboxRepo /
// pendingCaptures) — this component only renders it.
const BADGE = {
  synced: {
    label: 'Saved',
    icon: Icons.saved,
    
  },
  pending: {
    label: 'Unsaved',
    icon: Icons.unsaved,
  
  },
  failed: {
    label: 'Failed',
    icon: Icons.failed,
   
  },
};

const ImageSyncBadge = ({ state, style }) => {
  const cfg = BADGE[state];
  if (!cfg) {
    return null;
  }
  return (
    <View style={[styles.badge, style]} pointerEvents="none">
      <Image source={cfg.icon} style={[styles.icon, ]} />
    </View>
  );
};

const styles = {
  badge: {
    position: 'absolute',
    bottom: Responsive.height(3),
    right: Responsive.height(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sp4,
   
    borderRadius: BORDER_RADIUS.pill,
  },
  icon: {
    width: Responsive.height(42),
    height: Responsive.height(42),
    resizeMode: 'contain',
  },
  label: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs12,
  },
};

export default ImageSyncBadge;
