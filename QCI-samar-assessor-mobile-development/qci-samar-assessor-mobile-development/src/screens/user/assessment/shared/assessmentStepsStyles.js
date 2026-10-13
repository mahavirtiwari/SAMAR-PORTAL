import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../../../assets/theme/Theme';

export const styles = {
  assessmentInfo: {
    flexDirection: 'row',
    gap: SPACING.sp10
  },
  iconContainer: {
    width: Responsive.width(50),
    height: Responsive.height(40),

    ...commonStyles.center
  },
  clipboardIcon: {
    width: Responsive.width(24),
    height: Responsive.height(24)
  },
  assessmentDetails: {
    flex: 1,
    gap: Responsive.height(4)
  },
  locationRow: {
    gap: SPACING.sp4,
    flexDirection: 'row'
  },
  locationIcon: {
    width: Responsive.width(14),
    height: Responsive.height(14),
    tintColor: COLORS.text.tertiary
  },
  sizeContainer: {
    backgroundColor: COLORS.primary.primaryDark,
    paddingHorizontal: Responsive.width(12),
    paddingVertical: Responsive.height(6),
    borderRadius: BORDER_RADIUS.br6,
    alignSelf: 'flex-start',
    marginTop: Responsive.height(4)
  },
  allocationCard: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.br12,
    padding: Responsive.width(12),
    marginTop: Responsive.height(12),
    gap: Responsive.height(12)
  },
  allocationIcon: {
    width: Responsive.width(40),
    height: Responsive.height(40),
    borderRadius: BORDER_RADIUS.br10
  },
  allocationCountText: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.secondary
  },
  allocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sp8,
    height: Responsive.height(36),
    borderRadius: BORDER_RADIUS.br10,
    backgroundColor: COLORS.button.primary
  },
  punchCard: {
    backgroundColor: COLORS.background.primary,
    borderRadius: BORDER_RADIUS.br12,
    padding: Responsive.width(12),
    marginTop: Responsive.height(10),
    gap: Responsive.height(12)
  },
  punchIconCircle: {
    width: Responsive.width(40),
    height: Responsive.height(40),
    borderRadius: Responsive.width(20)
  },
  punchAvatar: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.success.active + '22',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.success.active,
    ...commonStyles.center
  },
  punchButton: {
    height: Responsive.height(36),
    borderRadius: BORDER_RADIUS.br10,
    ...commonStyles.center
  },
  progressContainer: {
    ...commonStyles.rowSpaceBetween,
    alignItems: 'center',
    gap: Responsive.width(12),
    // marginTop: Responsive.height(12),
    // borderTopWidth: 1,
    borderColor: COLORS.border.light,
    paddingVertical: Responsive.height(12)
  },
  progressBar: {
    flex: 1,
    height: Responsive.height(8),
    backgroundColor: COLORS.border.light,
    borderRadius: BORDER_RADIUS.br4,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.status.success,
    borderRadius: BORDER_RADIUS.br4
  },
  fullScreenModal: {
    flex: 1,
    paddingTop: 40,
    backgroundColor: COLORS.background.primary
  },
  fullScreenHeader: {
    ...commonStyles.rowSpaceBetween,
    alignItems: 'center',
    paddingHorizontal: Responsive.width(16),
    paddingTop: Responsive.height(50),
    paddingBottom: Responsive.height(20),
    backgroundColor: COLORS.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light
  },
  headerSpacer: {
    width: Responsive.width(40)
  },
  fullScreenContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Responsive.width(20)
  },
  bottomButtonContainer: {
    // paddingHorizontal: Responsive.width(20),
    paddingVertical: Responsive.height(20),
    backgroundColor: COLORS.background.primary
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: COLORS.background.primary,
    borderRadius: BORDER_RADIUS.br20,
    padding: Responsive.width(20),
    width: Responsive.width(320),
    alignItems: 'center'
  },
  modalHeader: {
    ...commonStyles.rowSpaceBetween,
    width: '100%',
    marginBottom: Responsive.height(20)
  },
  closeButton: {
    padding: Responsive.width(8)
  },
  closeIcon: {
    width: Responsive.width(24),
    height: Responsive.height(24)
  },
  cameraContainer: {
    alignItems: 'center',
    marginBottom: Responsive.height(20)
  },
  cameraCircle: {
    width: 258,
    height: 258,
    borderRadius: 170,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.background.primary,
    backgroundColor: COLORS.background.secondary
  },
  cameraView: {
    width: '100%',
    height: '100%'
  },
  cameraPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background.accent,
    borderColor: COLORS.success.primary,
    borderWidth: 4
  },
  placeholderAvatar: {
    width: Responsive.width(100),
    height: Responsive.width(100),
    borderRadius: Responsive.width(50),
    backgroundColor: COLORS.text.primary
  },
  timeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Responsive.height(20),
    flexDirection: 'row',
    gap: SPACING.sp10
  },
  timeIndicator: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  map: {
    width: '100%',
    height: '100%'
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background.secondary,
    width: Responsive.width(150),
    height: Responsive.height(100),
    tintColor: COLORS.text.tertiary,
    opacity: 0.3
  },
  mapPlaceholderIcon: {
    width: Responsive.width(80),
    height: Responsive.height(80),
    tintColor: COLORS.text.tertiary,
    opacity: 0.3
  },
  customMarker: {
    width: Responsive.width(40),
    height: Responsive.height(40),
    backgroundColor: COLORS.primary.main,
    borderRadius: Responsive.width(20),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.background.primary
  },
  markerIcon: {
    width: Responsive.width(20),
    height: Responsive.height(20),
    tintColor: COLORS.text.white
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: Responsive.height(40)
  },
  avatarWrapper: {
    position: 'relative',
    width: Responsive.width(150),
    height: Responsive.height(150),
    borderRadius: Responsive.width(75),
    overflow: 'hidden'
  },
  avatarAnimated: {
    borderWidth: 4,
    borderColor: COLORS.success.active
  },
  userAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: Responsive.width(75)
  },
  progressRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: Responsive.width(79),
    borderWidth: 4,
    borderColor: COLORS.success.active,
    borderTopColor: 'transparent'
  },

  mapContainer: {
    flex: 1,
    width: '100%',
    height: Responsive.height(200),
    backgroundColor: COLORS.background.secondary,
    borderRadius: BORDER_RADIUS.br12,
    position: 'relative',
    marginBottom: Responsive.height(20),
    ...commonStyles.center,
    overflow: 'hidden'
  },
  locationPin: {
    position: 'absolute',
    ...commonStyles.center,
    width: Responsive.width(40),
    height: Responsive.height(40),
    backgroundColor: COLORS.primary.main,
    borderRadius: Responsive.width(20)
  },
  pinIcon: {
    width: Responsive.width(20),
    height: Responsive.height(20),
    tintColor: COLORS.text.white
  },
  locationContainer: {
    alignItems: 'center'
  },
  checkInButtonContainer: {
    marginHorizontal: Responsive.width(15)
  },
  checkInButtonDisabled: {
    opacity: 0.7
  },
  warningContainer: {
    paddingHorizontal: Responsive.width(20),
    paddingVertical: Responsive.height(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sp10,
    borderRadius: BORDER_RADIUS.br6,
    backgroundColor: COLORS.warning.active,
    marginTop: Responsive.height(8),
    ...commonStyles.center
  },
  warningText: {
    ...commonStyles.FontFamily_Bold700,
    color: COLORS.text.white,
    fontSize: FONT_SIZE.fs12
  },
  storageWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sp10,
    paddingHorizontal: Responsive.width(12),
    paddingVertical: Responsive.height(10),
    borderRadius: BORDER_RADIUS.br8,
    backgroundColor: COLORS.warning.active,
    marginBottom: Responsive.height(12)
  },
  storageWarningText: {
    ...commonStyles.FontFamily_SemiBold600,
    flex: 1,
    color: COLORS.text.white,
    fontSize: FONT_SIZE.fs12
  },
  footerBannerContainer: {
    paddingHorizontal: Responsive.width(16),
    paddingTop: Responsive.height(16)
  },
  footerActionsRow: {
    flexDirection: 'row',
    gap: Responsive.width(8),
    paddingHorizontal: Responsive.width(16),
    paddingTop: Responsive.height(16),
    paddingBottom: Responsive.height(20),
    backgroundColor: COLORS.background.primary
  },
  footerActionButton: {
    flex: 1
  }
};
