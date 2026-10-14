import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { COLORS, FONT_SIZE } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';
import {
  getAllAssessmentsAction,
  getDashboardDataAction
} from '../../redux/action/assessmentAction';
import {
  countAllUnsynced,
  countStuckUnsynced
} from '../../services/database/repositories/outboxRepo';
import { drainOutbox } from '../../services/offline/syncEngine';
import { Logger } from '../../utils';
import { showErrorToast, showSuccessToast, showWarningToast } from '../../utils/toast';

// Global sync status + quick-sync control for the header. Shows the "async"
// (pending) icon while any captured data is still unsynced across all
// assessments, and the plain "sync" icon once everything is on the server.
// Tapping pushes the outbox (drainOutbox is global). The count refreshes on
// screen focus and after every sync, so it stays current as the user moves
// between screens and captures data.
const SyncStatusButton = ({ style, onSynced }) => {
  const dispatch = useDispatch();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const count = await countAllUnsynced();
      setPending(count);
    } catch {
      // non-critical UI — leave the last known count in place
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // One sentence per abort reason so every branch that surfaces a paused drain
  // says the same thing.
  const pausedMessage = (result) => {
    if (result.abortReason === 'rateLimited' || result.abortReason === 'serverUnavailable') {
      const seconds = Math.max(
        1,
        Math.ceil(((result.pausedUntil ?? Date.now()) - Date.now()) / 1000)
      );
      const resumesIn = seconds >= 90 ? `${Math.ceil(seconds / 60)} minutes` : `${seconds} seconds`;
      const cause =
        result.abortReason === 'serverUnavailable'
          ? 'The server is temporarily unavailable.'
          : 'The server asked us to slow down.';
      return `${cause} Your items are saved on this phone. Sync resumes automatically in about ${resumesIn}.`;
    }
    if (result.abortReason === 'busy') {
      return 'A sync is already running. Check again in a moment.';
    }
    return 'Your session has ended. Log in again to continue syncing.';
  };

  const handlePress = async () => {
    if (syncing) {
      return;
    }
    setSyncing(true);
    try {
      // Not forced: inside a rate-limit / server-outage pause the drain returns
      // at once and the toast below says when sync resumes.
      const result = await drainOutbox();
      // Rows the auto-drain will never pick up (retry-exhausted / server-
      // rejected). The drain reports processed=0 for these, so without this the
      // header would flash "All clear" while a stuck item still blocks Submit.
      const stuck = await countStuckUnsynced();
      if (result.offline) {
        showWarningToast(
          'You are offline',
          `${result.pending} item${
            result.pending === 1 ? ' is' : 's are'
          } saved on this phone and will upload automatically when the connection returns.`
        );
      } else if (result.succeeded > 0) {
        showSuccessToast(
          'Sync complete',
          `${result.succeeded} item${result.succeeded === 1 ? '' : 's'} uploaded.`
        );
        // Refresh the home list + dashboard so freshly-synced state shows
        // everywhere — baked in so any header that mounts this button works
        // without each screen having to wire it up.
        dispatch(getAllAssessmentsAction());
        dispatch(getDashboardDataAction());
        onSynced?.();
        if (stuck > 0) {
          showWarningToast(
            'Some items need attention',
            `${stuck} item${
              stuck === 1 ? '' : 's'
            } couldn’t sync. Open the assessment and tap the stuck-items banner to retry or discard.`
          );
        }
        // Uploaded some, then stopped: the remainder is still queued, say so.
        if (result.aborted) {
          showWarningToast('Sync paused', pausedMessage(result));
        }
      } else if (result.aborted) {
        // Nothing uploaded because the drain stopped itself: the session ended,
        // or the server asked this user to slow down. Say so; "All clear" here
        // would report success over a queue that is entirely still pending.
        showWarningToast('Sync paused', pausedMessage(result));
      } else if (result.failed > 0) {
        // The drain processed something and it failed THIS pass — surface the
        // real reason (a 4xx carries the server's message) so the field team
        // doesn't chase a non-existent connectivity problem. 5xx bodies carry
        // raw framework messages, so those (and no-response network failures)
        // keep the generic connection message.
        const rejection = result.failures?.find((f) => f.status >= 400 && f.status < 500);
        const count = `${result.failed} item${result.failed === 1 ? '' : 's'} failed.`;
        showErrorToast(
          'Sync incomplete',
          rejection ? `${count} ${rejection.message}` : `${count} Check connection and retry.`
        );
      } else if (stuck > 0) {
        // Nothing was auto-processed because the only unsynced rows are stuck
        // ones the drain has retired, plus any rows fenced behind them (a
        // punch-out waits for every earlier capture). Name both, so the badge
        // count and this message agree, and route the user to the review.
        const waiting =
          result.deferred > 0
            ? ` ${result.deferred} more item${
                result.deferred === 1 ? ' is' : 's are'
              } waiting behind ${stuck === 1 ? 'it' : 'them'}.`
            : '';
        showWarningToast(
          'Sync needs attention',
          `${stuck} item${
            stuck === 1 ? '' : 's'
          } couldn’t sync.${waiting} Open the assessment and tap the stuck-items banner to retry or discard.`
        );
      } else if (result.deferred > 0) {
        // Nothing failed — these rows are just queued behind items that must
        // sync first (punch-out behind earlier captures, evidence behind its
        // source site-tour picture), so "0 items failed, check connection"
        // would send the field team chasing a non-existent connectivity
        // problem. Reason-agnostic copy: the deferred count aggregates all
        // fence types.
        showWarningToast(
          'Sync waiting',
          `${result.deferred} item${
            result.deferred === 1 ? ' is' : 's are'
          } waiting for other items to sync first. Review any stuck items if this persists.`
        );
      } else {
        // Nothing uploaded, nothing failed this pass, nothing stuck, nothing
        // deferred → the outbox is genuinely empty.
        showSuccessToast('All clear', 'Nothing pending to sync.');
      }
    } catch (error) {
      Logger.warn('Header sync failed:', error?.message);
      showErrorToast('Sync failed', 'Could not sync. Check your connection and try again.');
    } finally {
      setSyncing(false);
      refresh();
    }
  };

  const hasPending = pending > 0;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.6}
      disabled={syncing}
      style={[styles.button]}>
      {syncing ? (
        // A visible spinner while the upload runs: a dimmed icon read as "did
        // nothing", so the field team kept tapping.
        <View style={[commonStyles.iconSize40, styles.spinner]}>
          <ActivityIndicator size="small" color={COLORS.primary.main} />
        </View>
      ) : (
        <Image source={hasPending ? Icons.async : Icons.sync} style={commonStyles.iconSize40} />
      )}
      {hasPending && !syncing && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pending > 99 ? '99+' : pending}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = {
  button: {
    marginTop: Responsive.height(10)
  },
  spinner: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  badge: {
    position: 'absolute',
    top: -Responsive.height(6),
    right: -Responsive.width(6),
    minWidth: Responsive.width(16),
    height: Responsive.height(16),
    paddingHorizontal: Responsive.width(3),
    borderRadius: Responsive.width(8),
    backgroundColor: COLORS.status.warning,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeText: {
    color: COLORS.text.white,
    fontSize: FONT_SIZE.fs10,
    ...commonStyles.FontFamily_SemiBold600
  }
};

export default SyncStatusButton;
