import { Image, Pressable, Text, View } from 'react-native';
import { commonStyles } from '../../../../assets/theme/Styles';
import { COLORS } from '../../../../assets/theme/Theme';
import { AppButton } from '../../../../components';
import AppCommonModal from '../../../../components/modals/AppCommonModal';
import Icons from '../../../../constants/Icons';
import Images from '../../../../constants/Images';
import { styles } from './assessmentStepsStyles';
import { FOOTER_STATE } from './useOutboxSync';

// Single footer for both role screens (lead + co) so their completion flow can't
// drift apart. The action shown is driven entirely by sync.footerState; the
// terminal "Submit Assessment" only renders in the READY/WAITING states, never
// as a catch-all default. Saving/syncing lives in the header (SyncStatusButton),
// so there is no Save button here.
const Wrap = ({ children }) => (
  <View style={[commonStyles.padding16, { backgroundColor: COLORS.background.primary }]}>
    {children}
  </View>
);

const WarningBanner = ({ message }) => (
  <View style={styles.storageWarningBanner}>
    <Image
      source={Icons.warningIcon}
      style={[commonStyles.iconSize18, { tintColor: COLORS.text.white }]}
    />
    <Text style={styles.storageWarningText}>{message}</Text>
  </View>
);

// Warning-banner copy per blocked footer state; null when the state needs no banner.
const bannerMessageFor = (footerState, sync) => {
  switch (footerState) {
    case FOOTER_STATE.PUNCH_OUT_REQUIRED:
      return 'Please punch out before completing the assessment.';
    case FOOTER_STATE.UNSYNCED:
      // When every unsynced row is stuck (or fenced behind a stuck one, which
      // the counts cannot tell apart), the failed banner above already carries
      // the action and a second "use the sync icon" banner would contradict it.
      // Fresh syncable captures alongside stuck rows still get the prompt.
      return sync.failedCount > 0 && sync.pendingCount - sync.failedCount <= 1
        ? null
        : 'Sync your data using the sync icon at the top before completing the assessment.';
    case FOOTER_STATE.WAITING_CO_ASSESSORS:
      return (
        sync.completeBlockers[0] ||
        'Completion will be enabled once your co-assessors finish and sync their data.'
      );
    default:
      return null;
  }
};

// isLead gates the destructive Reset Data action: restarting wipes the whole
// team's captures, so only the lead assessor's footer offers it. The server
// enforces this too — the UI gate is just so co-assessors never see the button.
const AssessmentFooter = ({ sync, isLead = false }) => {
  const { footerState } = sync;
  const failedBanner =
    footerState !== FOOTER_STATE.CLEARED && sync.failedCount > 0 ? (
      <View style={commonStyles.paddingHorizontal16}>
        <Pressable onPress={sync.openFailedModal} style={styles.storageWarningBanner}>
          <Image
            source={Icons.warningIcon}
            style={[commonStyles.iconSize18, { tintColor: COLORS.text.white }]}
          />
          <Text style={styles.storageWarningText}>
            {sync.failedCount} item{sync.failedCount === 1 ? '' : 's'} couldn’t sync to the server.
            Tap to review, retry, or discard.
          </Text>
        </Pressable>
      </View>
    ) : null;

  // Terminal text-only states: local data is cleared or clearing, no action row.
  if (footerState === FOOTER_STATE.CLEARED) {
    return (
      <>
        {failedBanner}
        <Wrap>
          <Text style={[commonStyles.bodySmallTertiary500, commonStyles.textCenter]}>
            Data cleared from this device — saved on the server.
          </Text>
        </Wrap>
      </>
    );
  }
  if (footerState === FOOTER_STATE.COMPLETED) {
    // Completed on mobile: local data clears automatically once everything has
    // synced (no manual Clear button). Until then, guide the assessor to finish
    // syncing; the auto-clear then transitions this to CLEARED.
    return (
      <>
        {failedBanner}
        <Wrap>
          <Text style={[commonStyles.bodySmallTertiary500, commonStyles.textCenter]}>
            {sync.pendingCount > 0 || sync.failedCount > 0
              ? 'Completed. Sync the remaining data using the sync icon at the top — this device’s copy clears automatically once syncing finishes.'
              : 'Completed. Clearing this device’s data…'}
          </Text>
        </Wrap>
      </>
    );
  }

  const bannerMessage = bannerMessageFor(footerState, sync);
  const submitEnabled = footerState === FOOTER_STATE.READY;

  return (
    <>
      {failedBanner}
      {bannerMessage ? (
        <View style={styles.footerBannerContainer}>
          <WarningBanner message={bannerMessage} />
        </View>
      ) : null}
      {/* Reset (bottom-left) and Submit (bottom-right) share one row so the two
          terminal actions stay on opposite ends across all devices. Reset is
          lead-only; when absent, Submit takes the full width. */}
      <View style={styles.footerActionsRow}>
        {isLead ? (
          <View style={styles.footerActionButton}>
            <AppButton
              onPress={sync.handleResetData}
              disabled={sync.resettingData}
              title={sync.resettingData ? 'Resetting…' : 'Reset Assessment'}
              size="medium"
              variant="danger"
              // Drop the icon while resetting so the button shows only the
              // spinner, not the reset icon and the loader side by side.
              icon={sync.resettingData ? undefined : Icons.reset}
              loader={sync.resettingData}
            />
          </View>
        ) : null}
        <View style={styles.footerActionButton}>
          <AppButton
            disabled={!submitEnabled || sync.completingMobile}
            title="Submit Assessment"
            size="medium"
            variant="primary"
            icon={Icons.buttonIcon}
            onPress={submitEnabled ? () => sync.setShowCompleteMobileModal(true) : undefined}
          />
        </View>
      </View>
      {isLead ? (
        <AppCommonModal
          showmodal={sync.showResetDataModal}
          imgsrc={Images.resetModal}
          title="Reset Assessment?"
          subTitle="This will permanently remove all captured assessment data and start the assessment again from the beginning. This cannot be undone."
          twoButtonModal={true}
          leftButtonText="Cancel"
          rightButtonText="Delete"
          leftvariant="secondary"
          leftButtonColor={COLORS.primary.soft}
          LeftbuttonTextColor={COLORS.primary.main}
          variant="danger"
          LeftonPress={() => sync.setShowResetDataModal(false)}
          onPress={sync.confirmResetData}
        />
      ) : null}
    </>
  );
};

export default AssessmentFooter;
