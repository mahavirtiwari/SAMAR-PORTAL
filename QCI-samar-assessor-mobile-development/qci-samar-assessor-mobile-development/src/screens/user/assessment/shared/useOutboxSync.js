import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import AppSettings from '../../../../../appsettings';
import { resetAttendanceStatusState } from '../../../../redux/slices/assessmentSlice';
import Api from '../../../../services/api';
import { idFromServer } from '../../../../services/database/ids';
import {
  clearAssessmentLocalData,
  isMobileCompleted,
  isMobileRoleDone,
  markMobileCompleted,
  markMobileRoleDone
} from '../../../../services/database/repositories/assessmentsRepo';
import {
  countPendingForAssessment,
  getUnsyncedSummaryForAssessment,
  listUnsyncedForAssessment,
  resetForRetry
} from '../../../../services/database/repositories/outboxRepo';
import { discardStuckCapture } from '../../../../services/offline/discardCapture';
import { downloadAssessmentForOffline } from '../../../../services/offline/downloadAssessment';
import { deletePhotosForAssessment } from '../../../../services/offline/photoStorage';
import { drainOutbox } from '../../../../services/offline/syncEngine';
import {
  checkInternetConnection,
  subscribeToNetworkChanges
} from '../../../../utils/checkInternetConnection';
import { mapApiError } from '../../../../utils/errorMessages';
import { Logger } from '../../../../utils/logger';
import { showErrorToast, showSuccessToast, showWarningToast } from '../../../../utils/toast';

// The footer's single source of truth, shared by the lead and co-assessor
// screens so they can't drift apart. Each value maps to exactly one footer
// action; the terminal "Complete on Mobile" only surfaces in READY/WAITING,
// never as a fallback for unhandled states.
export const FOOTER_STATE = {
  CLEARED: 'cleared', // local data wiped after completion
  COMPLETED: 'completed', // cutover done, device not yet cleared → Clear Local Data
  PUNCH_OUT_REQUIRED: 'punchOutRequired', // steps done but still punched in
  UNSYNCED: 'unsynced', // wrapped up but data still pending/rejected
  WAITING_CO_ASSESSORS: 'waitingCoAssessors', // lead ready, co-assessors not done
  READY: 'ready', // everything done + synced → Complete on Mobile
  WORKING: 'working' // still mid-assessment → no footer action
};

// Pure. Order matters: terminal/cleanup states first, then the readiness ladder.
// Save/sync is a header concern (SyncStatusButton), so there is no "save" state.
export const deriveFooterState = ({
  mobileRoleDone,
  mobileCompleted,
  roleStepsComplete,
  isPunchedIn,
  pendingCount,
  failedCount,
  coAssessorGateActive,
  canComplete,
  isOnline = true
}) => {
  if (mobileRoleDone) {
    return FOOTER_STATE.CLEARED;
  }
  if (mobileCompleted) {
    return FOOTER_STATE.COMPLETED;
  }
  if (!roleStepsComplete) {
    return FOOTER_STATE.WORKING;
  }
  if (isPunchedIn) {
    return FOOTER_STATE.PUNCH_OUT_REQUIRED;
  }
  if (pendingCount > 0 || failedCount > 0) {
    return FOOTER_STATE.UNSYNCED;
  }
  // Completing on mobile is online-only (handleCompleteMobile needs a
  // connection) and, with co-assessors, gated by the server's canComplete.
  // Online: block only on an explicit false so an undefined/never-fetched
  // status never permanently traps the lead; once the server confirms (true)
  // it clears. Offline: canComplete can't be fetched (stays undefined) and we
  // couldn't complete anyway, so never surface an enabled Complete button —
  // hold in WAITING until back online, where the real canComplete decides.
  if (coAssessorGateActive && (canComplete === false || (!isOnline && canComplete !== true))) {
    return FOOTER_STATE.WAITING_CO_ASSESSORS;
  }
  return FOOTER_STATE.READY;
};

const useOutboxSync = ({
  assessmentId,
  navigation,
  isPunchedIn,
  roleStepsComplete,
  coAssessorGateActive
}) => {
  const dispatch = useDispatch();
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [failedItems, setFailedItems] = useState([]);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [deletingData, setDeletingData] = useState(false);
  const [resettingData, setResettingData] = useState(false);
  const [showResetDataModal, setShowResetDataModal] = useState(false);
  // Auto-clear fires once per screen lifetime; the ref guards against the
  // effect re-running while the async clear is in flight.
  const autoClearedRef = useRef(false);
  const [mobileRoleDone, setMobileRoleDone] = useState(false);
  const [completionStatus, setCompletionStatus] = useState(null);
  const [mobileCompleted, setMobileCompleted] = useState(false);
  const [completingMobile, setCompletingMobile] = useState(false);
  const [showCompleteMobileModal, setShowCompleteMobileModal] = useState(false);
  // Full-screen "Submitted Successfully!" confirmation, shown after a
  // server-confirmed cutover; auto-dismisses (3s) and the screen navigates back.
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);
  // Connectivity drives the footer: completing on mobile is online-only, so an
  // enabled "Complete on Mobile" must never show offline. Optimistic default
  // (true) matches isUsableConnection's "unknown = online" stance; the
  // subscription corrects it immediately and on every change.
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToNetworkChanges(setIsOnline);
    return unsubscribe;
  }, []);

  // Re-read the local outbox counts, the role-done/completed flags, and the
  // server's completion gate (canComplete / blockers). Shared by the focus
  // effect and pull-to-refresh: the gate's canComplete flips on the server
  // when a co-assessor finishes, but nothing on this screen re-fetches it
  // between focus events — without exposing this, the lead's Submit button
  // stayed stuck in WAITING_CO_ASSESSORS until a full remount via Home.
  const refreshSyncState = useCallback(async () => {
    try {
      const localId = idFromServer(assessmentId);
      setPendingCount(await countPendingForAssessment(localId));
      setFailedCount((await getUnsyncedSummaryForAssessment(localId)).failed || 0);
      setMobileRoleDone(await isMobileRoleDone(localId));
      setMobileCompleted(await isMobileCompleted(localId));
      // The server is authoritative on the completion gate (canComplete /
      // blockers): a lead can't cut over until every co-assessor has, and
      // only the server knows that. Refresh it when online; offline keeps
      // the last-known status (or none) without blocking the screen. The
      // gate only matters once punched out (cutover requires it), so skip
      // the network call during the on-site window.
      const online = await checkInternetConnection();
      setIsOnline(online);
      if (!isPunchedIn && online) {
        try {
          const status = await Api.AssessmentApi.getMobileCompletionStatus(assessmentId);
          setCompletionStatus(status?.data ?? null);
          if (status?.data?.me?.mobile_completed) {
            setMobileCompleted(true);
          }
        } catch (statusErr) {
          Logger.warn('Mobile completion status fetch failed', statusErr?.message);
        }
      }
    } catch (err) {
      Logger.warn('Pending/role-done check failed', err?.message);
    }
  }, [assessmentId, isPunchedIn]);

  // Keep the local unsynced-items count fresh so the Delete-Data gate (mobile
  // role over = role steps complete + nothing left to sync) stays accurate.
  // Keyed on isPunchedIn too: punch-out happens on this same screen (no focus
  // change), and the punch thunk resolves only after its capture-time drain,
  // so when the flag flips, the pending count and the server's completion
  // status (whose blockers include "punch out first") must be re-read or the
  // bottom button renders from pre-punch-out state.
  useFocusEffect(
    useCallback(() => {
      refreshSyncState();
    }, [refreshSyncState])
  );

  const OP_LABELS = {
    punchIn: 'Punch in',
    punchOut: 'Punch out',
    startAssessment: 'Start assessment',
    'meeting:opening': 'Opening meeting',
    'meeting:closing': 'Closing meeting',
    sitePicture: 'Site picture',
    siteTourPicture: 'Site tour picture',
    sitePictureDelete: 'Site picture removal',
    siteTourPictureDelete: 'Site tour picture removal',
    response: 'Question response',
    responseEvidence: 'Response evidence',
    responseEvidenceDelete: 'Evidence removal',
    basicInformation: 'Basic information',
    parameterAllocation: 'Parameter allocation'
  };
  const humanizeOp = (opType) => OP_LABELS[opType] || opType;

  const refreshFailed = async (localId) => {
    setPendingCount(await countPendingForAssessment(localId));
    const blocked = (await listUnsyncedForAssessment(localId)).filter((i) => i.blocked);
    setFailedItems(blocked);
    setFailedCount(blocked.length);
    return blocked.length;
  };

  const openFailedModal = async () => {
    try {
      const localId = idFromServer(assessmentId);
      setFailedItems((await listUnsyncedForAssessment(localId)).filter((i) => i.blocked));
      setShowFailedModal(true);
    } catch (err) {
      Logger.warn('Failed to load stuck items', err?.message);
    }
  };

  // "Retry" clears the auto-retry cap + terminal flag and drains again. Fixes
  // transient failures; a genuinely rejected payload (bad data) will fail again,
  // in which case Discard is the only way forward.
  const handleRetryFailed = async () => {
    if (retryingFailed) {
      return;
    }
    setRetryingFailed(true);
    try {
      const localId = idFromServer(assessmentId);
      await resetForRetry({ assessmentId: localId });
      // Not forced: a rate-limit / server-outage pause is honoured and reported.
      const result = await drainOutbox();
      await refreshFailed(localId);
      const remaining = (await getUnsyncedSummaryForAssessment(localId)).failed || 0;
      // resetForRetry zeroes retry_count, so `remaining` alone reads as 0 even
      // when nothing was uploaded; success needs the drain to have sent something.
      if (result.offline) {
        showWarningToast(
          'You are offline',
          'The items were reset and will upload automatically when the connection returns.'
        );
      } else if (result.aborted) {
        const pausedCopy = {
          rateLimited: 'The server asked us to slow down. Try again in a minute.',
          serverUnavailable:
            'The server is temporarily unavailable. The items are saved and will retry automatically.',
          busy: 'A sync is already running. Try again in a moment.'
        };
        showWarningToast(
          'Sync paused',
          pausedCopy[result.abortReason] ||
            'Your session has ended. Log in again to continue syncing.'
        );
      } else if (remaining === 0 && result.succeeded > 0) {
        setShowFailedModal(false);
        showSuccessToast('Synced', 'The stuck items were sent to the server.');
      } else if (remaining === 0 && result.deferred > 0) {
        // Nothing failed; the retried rows are queued behind items that must
        // sync first (punch-out fence, evidence behind its source picture).
        showWarningToast(
          'Sync waiting',
          `${result.deferred} item${
            result.deferred === 1 ? ' is' : 's are'
          } waiting for other items to sync first.`
        );
      } else {
        const stillStuck = remaining || result.failed;
        showErrorToast(
          'Still stuck',
          stillStuck > 0
            ? `${stillStuck} item${
                stillStuck === 1 ? '' : 's'
              } could not sync. Review the error and discard if it can’t be fixed.`
            : 'Nothing was sent. Check your connection and try again.'
        );
      }
    } catch (err) {
      Logger.error('Retry failed items error:', err);
      showErrorToast('Retry Failed', mapApiError(err));
    } finally {
      setRetryingFailed(false);
    }
  };

  // Discard drops the queued sync for an item the user gives up on. Its captured
  // data won't reach the server; the eventual Delete Data clears the local copy.
  // Discarding the last stuck item closes the review modal — leaving it open on
  // "Nothing stuck" reads as the app itself being stuck.
  const handleDiscardItem = async (id) => {
    try {
      // Also removes the local capture (row + photo), so the phone never keeps
      // showing data the server will never hold.
      await discardStuckCapture(failedItems.find((item) => item.id === id) ?? { id });
      const remaining = await refreshFailed(idFromServer(assessmentId));
      if (remaining === 0) {
        setShowFailedModal(false);
      }
      showSuccessToast('Discarded', 'The item was removed and won’t be sent to the server.');
    } catch (err) {
      Logger.error('Discard item error:', err);
      showErrorToast('Discard Failed', 'Could not discard the item. Please try again.');
    }
  };

  // Online-only cutover: confirms on the server that this assessor's field work
  // is done. Hard-terminal — after it the assessment stops syncing down to this
  // assessor and Delete Data unlocks. The server gates the lead's cutover until
  // every co-assessor has completed (canComplete / blockers).
  const handleCompleteMobile = async () => {
    if (completingMobile) {
      return;
    }
    if (!(await checkInternetConnection())) {
      showWarningToast('No connection', 'Completing on mobile needs an internet connection.');
      return;
    }
    setCompletingMobile(true);
    try {
      const localId = idFromServer(assessmentId);
      const deviceMetadata = {
        deviceModel: Platform.OS === 'ios' ? 'iOS Device' : 'Android Device',
        osVersion: `${Platform.OS} ${Platform.Version}`,
        appVersion: AppSettings.VERSION_DISPLAY
      };
      const result = await Api.AssessmentApi.completeMobile(assessmentId, deviceMetadata);
      const payload = result?.data ?? null;
      await markMobileCompleted(
        localId,
        payload?.me?.mobile_completed_at || new Date().toISOString()
      );
      setMobileCompleted(true);
      setCompletionStatus(payload);
      setShowCompleteMobileModal(false);
      // The full-screen "Submitted Successfully!" confirmation replaces the
      // toast here; it auto-dismisses after 3s and the screen navigates back.
      setShowSubmitSuccess(true);
    } catch (err) {
      Logger.error('Complete on mobile failed:', err);
      const data = err?.response?.data;
      // 5xx bodies carry raw framework/SQL messages — never show those.
      const message =
        err?.response?.status >= 500
          ? 'Server error. Please try again later.'
          : data?.message || data?.blockers?.[0] || mapApiError(err);
      showErrorToast('Cannot complete', message);
    } finally {
      setCompletingMobile(false);
      setShowCompleteMobileModal(false);
    }
  };

  // The single local-cleanup routine for a completed assessment: wipe this
  // assessment's captured data + photos and mark its mobile role done (the
  // shell row survives so the CLEARED footer state persists). Shared by the
  // automatic post-sync clear and the (retained) manual safety path.
  const performLocalClear = useCallback(async (localId) => {
    // Never wipe photos while any capture for this assessment is still unsynced.
    // A stale/false 'synced' must not cost the user un-uploaded evidence: the
    // deleted files then fail the drain as "image file missing" and can only be
    // re-captured (Problem B). The outbox is the source of truth for pending
    // uploads, so re-check it here — not just the cached counts — before wiping.
    const { pending, failed } = await getUnsyncedSummaryForAssessment(localId);
    if ((pending || 0) + (failed || 0) > 0) {
      Logger.warn(
        `[clear] skipped photo wipe for ${localId} — ${(pending || 0) + (failed || 0)} capture(s) still unsynced`
      );
      return;
    }
    await clearAssessmentLocalData(localId);
    await deletePhotosForAssessment(localId);
    await markMobileRoleDone(localId);
    setMobileRoleDone(true);
  }, []);

  // Auto-clear on completion + sync: once the assessment is completed on mobile
  // AND everything has synced (nothing pending or stuck), the device copy is
  // removed automatically — no manual "Clear Data" button. Never clears while
  // anything is still unsynced, so no server-unconfirmed capture is lost.
  useEffect(() => {
    if (
      mobileCompleted &&
      !mobileRoleDone &&
      pendingCount === 0 &&
      failedCount === 0 &&
      !deletingData &&
      !autoClearedRef.current
    ) {
      autoClearedRef.current = true;
      (async () => {
        try {
          await performLocalClear(idFromServer(assessmentId));
          Logger.info('Auto-cleared local data after completion + sync');
        } catch (err) {
          autoClearedRef.current = false; // let a later render retry
          Logger.warn('Auto-clear after completion failed:', err?.message);
        }
      })();
    }
  }, [
    mobileCompleted,
    mobileRoleDone,
    pendingCount,
    failedCount,
    deletingData,
    assessmentId,
    performLocalClear
  ]);

  const handleDeleteData = async () => {
    // Manual safety path (no longer surfaced as a button — completed+synced now
    // auto-clears). Kept for defensive re-entry; re-checks the cutover flag and
    // the outbox so a stale UI can't wipe unsaved data.
    if (!mobileCompleted) {
      showWarningToast(
        'Not completed yet',
        'Complete this assessment on mobile before clearing local data.'
      );
      return;
    }
    setShowDeleteDataModal(false);
    setDeletingData(true);
    try {
      const localId = idFromServer(assessmentId);
      const stillPending = await countPendingForAssessment(localId);
      if (stillPending > 0) {
        setPendingCount(stillPending);
        showWarningToast(
          'Not fully synced',
          'Some items still need to sync to the server. Try again once syncing is complete.'
        );
        return;
      }
      await performLocalClear(localId);
      showSuccessToast(
        'Data cleared',
        'This assessment’s data has been removed from this device. It stays saved on the server.'
      );
      navigation.goBack();
    } catch (error) {
      Logger.error('Delete assessment data failed:', error);
      showErrorToast('Delete Failed', 'Could not clear local data. Please try again.');
    } finally {
      setDeletingData(false);
    }
  };

  // Reset Data: restart an in-progress assessment by wiping its local captures
  // (data + photos + outbox) and re-hydrating a fresh copy from the server, so
  // the assessor begins again from the start. Destructive → confirmed first;
  // only for in-progress assessments (never after mobile completion), and only
  // touches this assessment's local data.
  const handleResetData = () => {
    if (mobileCompleted || resettingData) {
      return;
    }
    setShowResetDataModal(true);
  };

  const confirmResetData = async () => {
    if (mobileCompleted || resettingData) {
      return;
    }
    setShowResetDataModal(false);
    setResettingData(true);
    try {
      const online = await checkInternetConnection();
      const localId = idFromServer(assessmentId);

      // Online: clear the server's captured data FIRST. Otherwise the
      // re-hydrate below re-downloads the synced answers/basic-info we
      // just cleared locally and the assessment looks unchanged on
      // reopen — the reported bug. A failure here aborts the reset (no
      // false success) via the outer catch.
      if (online) {
        await Api.AssessmentApi.resetAssessmentData(assessmentId);
      }

      await clearAssessmentLocalData(localId);
      await deletePhotosForAssessment(localId);
      // The reset deleted this device's attendance rows (and the server's when
      // online), but the Redux status keeps its last known value across a
      // failed re-read (offline).
      // Left alone it still says "punched in", the screen offers Punch Out,
      // and that punch-out is queued ahead of the new punch-in. The server
      // rejects it and the terminal row fences the real punch-out for good.
      dispatch(resetAttendanceStatusState());

      // Re-hydrate only when online — pulls back the preserved parameter
      // allocation and a now-empty capture set. Offline, the local wipe
      // stands on its own; the next online open re-hydrates.
      if (online) {
        try {
          await downloadAssessmentForOffline(assessmentId);
        } catch (dlErr) {
          Logger.warn('Reset re-hydrate failed (will retry on next open):', dlErr?.message);
        }
      }

      showSuccessToast(
        'Assessment reset',
        online
          ? 'This assessment was cleared. Start again from the beginning.'
          : 'Local data cleared. Start again from the beginning.'
      );
      navigation.goBack();
    } catch (error) {
      Logger.error('Reset assessment data failed:', error);
      showErrorToast(
        'Reset Failed',
        mapApiError(error) || 'Could not reset the assessment. Please try again.'
      );
    } finally {
      setResettingData(false);
    }
  };

  // canComplete can sit at a few shapes depending on the API envelope; read it
  // defensively so a wrapper mismatch doesn't leave it permanently undefined.
  const canComplete =
    completionStatus?.me?.canComplete ??
    completionStatus?.canComplete ??
    completionStatus?.data?.me?.canComplete ??
    completionStatus?.me?.canComplete ??
    completionStatus?.canComplete;

  const footerState = deriveFooterState({
    mobileRoleDone,
    mobileCompleted,
    roleStepsComplete,
    isPunchedIn,
    pendingCount,
    failedCount,
    coAssessorGateActive,
    canComplete,
    isOnline
  });

  return {
    pendingCount,
    setPendingCount,
    failedCount,
    footerState,
    // Re-reads outbox counts + the server completion gate. Wire into each
    // screen's pull-to-refresh so the Submit gate (canComplete) updates in
    // place when a co-assessor finishes, without a remount via Home.
    refreshSyncState,
    // True the instant the assessment is completed on mobile (and on re-entry,
    // hydrated from the local flag) — lets screens react without waiting for a
    // server refetch of assessmentData.status.
    mobileCompleted,
    completeBlockers: completionStatus?.me?.blockers || [],
    completingMobile,
    showCompleteMobileModal,
    setShowCompleteMobileModal,
    handleCompleteMobile,
    showSubmitSuccess,
    setShowSubmitSuccess,
    deletingData,
    resettingData,
    handleResetData,
    confirmResetData,
    showResetDataModal,
    setShowResetDataModal,
    showDeleteDataModal,
    setShowDeleteDataModal,
    showFailedModal,
    setShowFailedModal,
    failedItems,
    retryingFailed,
    openFailedModal,
    handleRetryFailed,
    handleDiscardItem,
    handleDeleteData,
    humanizeOp
  };
};

export default useOutboxSync;
