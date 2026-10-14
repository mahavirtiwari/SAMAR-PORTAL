import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { COLORS, FONT_SIZE } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';
import {
  countAllUnsynced,
  countStuckUnsynced,
} from '../../services/database/repositories/outboxRepo';
import { drainOutbox } from '../../services/offline/syncEngine';
import { Logger } from '../../utils/logger';
import { showErrorToast, showSuccessToast, showWarningToast } from '../../utils/toastUtils';

/**
 * Header sync indicator + manual-sync control. Shows the "pending" icon with a
 * count badge while any captured data is still unsynced, and the plain "sync"
 * icon once everything is on the server. Tapping pushes the outbox. The count
 * refreshes on screen focus and after every sync.
 */
const SyncStatusButton = ({ style, onSynced }) => {
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
    }, [refresh]),
  );

  // One sentence per abort reason so every branch that reports a stopped drain
  // says the same thing.
  const pausedMessage = result => {
    if (result.abortReason === 'busy') {
      return 'A sync is already running. Check again in a moment.';
    }
    const seconds = Math.max(
      1,
      Math.ceil(((result.pausedUntil ?? Date.now()) - Date.now()) / 1000),
    );
    const resumesIn = seconds >= 90 ? `${Math.ceil(seconds / 60)} minutes` : `${seconds} seconds`;
    const cause =
      result.abortReason === 'serverUnavailable'
        ? 'The server is temporarily unavailable.'
        : 'The server asked us to slow down.';
    return `${cause} Your photos are saved on this phone. Sync resumes automatically in about ${resumesIn}.`;
  };

  const handlePress = async () => {
    if (syncing) {
      return;
    }
    setSyncing(true);
    try {
      const result = await drainOutbox();
      const stuck = await countStuckUnsynced();
      if (result.succeeded > 0) {
        showSuccessToast(
          'Sync complete',
          `${result.succeeded} item${result.succeeded === 1 ? '' : 's'} uploaded.`,
        );
        onSynced?.();
        if (stuck > 0) {
          showWarningToast(
            'Some items need attention',
            `${stuck} item${
              stuck === 1 ? '' : 's'
            } couldn't sync. Retry when you have a stable connection.`,
          );
        }
        // Uploaded some, then stopped: the remainder is still queued, say so.
        if (result.aborted) {
          showWarningToast('Sync paused', pausedMessage(result));
        }
      } else if (result.aborted) {
        // Nothing uploaded because the drain stopped itself (rate limit, server
        // outage, or a sync already running). "All clear" here would report
        // success over a queue that is still pending.
        showWarningToast('Sync paused', pausedMessage(result));
      } else if (result.failed > 0) {
        // Surface the real reason: a 4xx carries the server's message, so the
        // user doesn't chase a non-existent connectivity problem.
        const rejection = result.failures?.find(f => f.status >= 400 && f.status < 500);
        const count = `${result.failed} item${result.failed === 1 ? '' : 's'} failed.`;
        showErrorToast(
          'Sync incomplete',
          rejection ? `${count} ${rejection.message}` : `${count} Check connection and retry.`,
        );
      } else if (stuck > 0) {
        showWarningToast(
          'Sync needs attention',
          `${stuck} item${
            stuck === 1 ? '' : 's'
          } couldn't sync. Retry when you have a stable connection.`,
        );
      } else {
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
    <TouchableOpacity onPress={handlePress} activeOpacity={0.6} disabled={syncing} style={style}>
      <Image
        source={hasPending ? Icons.sync : Icons.syncPending}
        style={[commonStyles.iconSize40, syncing && { opacity: 0.4 }]}
      />
      {hasPending && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pending > 99 ? '99+' : pending}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = {
  badge: {
    position: 'absolute',
    top: -Responsive.height(6),
    right: -Responsive.width(6),
    minWidth: Responsive.width(16),
    height: Responsive.height(16),
    paddingHorizontal: Responsive.width(3),
    borderRadius: Responsive.width(8),
    backgroundColor: COLORS.warning.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: COLORS.text.white,
    fontSize: FONT_SIZE.fs10,
    ...commonStyles.FontFamily_SemiBold600,
  },
};

export default SyncStatusButton;
