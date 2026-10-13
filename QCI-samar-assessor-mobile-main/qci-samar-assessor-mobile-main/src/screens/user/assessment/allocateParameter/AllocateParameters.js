// Check if all mandatory parameters are selected in selectAllParameter

import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Image, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../../../assets/theme/Theme';
import { AppButton } from '../../../../components';
import { Header } from '../../../../components/layout';
import { AppCommonModal } from '../../../../components/modals';
import AppScrollView from '../../../../components/shared/AppScrollView';
import ApplicationLoader from '../../../../components/shared/Loader';
import UserInitial from '../../../../components/shared/UserInitial';
import Icons from '../../../../constants/Icons';
import Images from '../../../../constants/Images';
import {
  getAssessmentByIdAction,
  getStepProgressAction
} from '../../../../redux/action/assessmentAction';
import {
  bulkAssignParametersAction,
  getAssessmentParametersAction,
  getMyAssessmentsAction
} from '../../../../redux/action/assessmentParameterAction';
import {
  resetBulkAssignParametersState,
  setSelectAllParameter
} from '../../../../redux/slices/assessmentParameterSlice';
import { idFromServer } from '../../../../services/database/ids';
import { getMeetingByType } from '../../../../services/database/repositories/meetingsRepo';
import { Logger } from '../../../../utils';
import { checkInternetConnection } from '../../../../utils/checkInternetConnection';
import {
  isParameterAssignedToMember,
  normalizeTeamMembers,
  resolveTeamRole
} from '../../../../utils/teamRole';

const AllocateParameters = ({ route }) => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { assessmentId } = route.params;
  const [successModal, setSuccessModal] = useState(false);
  const [modal, setModal] = useState(false);
  const [hasLocalOpeningMeeting, setHasLocalOpeningMeeting] = useState(false);

  useEffect(() => {
    dispatch(getAssessmentParametersAction(assessmentId));
    dispatch(getMyAssessmentsAction(assessmentId));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meeting = await getMeetingByType(idFromServer(assessmentId), 'opening');
        if (!cancelled) {
          setHasLocalOpeningMeeting(!!meeting);
        }
      } catch (err) {
        Logger.warn('Failed to check local opening meeting', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assessmentId]);

  const {
    assessmentParameters,
    assessmentParametersLoading,
    bulkAssignParametersLoading,
    bulkAssignParametersData,
    bulkAssignParametersError,
    selectAllParameter
  } = useSelector((state) => state.assessmentParameter);

  const { assessmentData } = useSelector((state) => state.assessment);
  const { userData } = useSelector((state) => state.account);

  const currentUserId = userData?.user?.id;
  const { isLead, isCoAssessor } = resolveTeamRole(assessmentData?.assessment, currentUserId);

  // Team members (lead + co-assessors) for the allocation UI. The parameters API
  // carries them, but that response isn't mirrored offline — fall back to the
  // locally mirrored assessment payload so the lead/co names still render with
  // no connection. Same shape ({ id, role, user: { id, firstName, lastName } }).
  const teamMembers = assessmentParameters?.teamMembers?.length
    ? assessmentParameters.teamMembers
    : normalizeTeamMembers(assessmentData?.assessment?.teamMembers);
  // Allocation is locked the moment it is saved (server stamps allocation_locked_at)
  // and stays locked once the opening meeting is recorded. The parameters response
  // — refetched on every entry to this screen — carries the authoritative flag, so
  // re-opening the screen after a save always reflects the lock. The mirrored
  // assessment payload is the offline fallback.
  const isAllocationLocked =
    assessmentParameters?.allocationLocked === true ||
    assessmentData?.assessment?.allocationLocked === true ||
    hasLocalOpeningMeeting;
  const isReadOnly = isCoAssessor || isAllocationLocked;

  useEffect(() => {
    if (assessmentParametersLoading || bulkAssignParametersLoading) {
      ApplicationLoader.show('allocateParameters');
    } else {
      ApplicationLoader.hide('allocateParameters');
    }

    (async () => {
      if (bulkAssignParametersData) {
        setSuccessModal(true);

        setTimeout(() => {
          setSuccessModal(false);
          dispatch(getStepProgressAction(assessmentId));
          dispatch(getMyAssessmentsAction(assessmentId));
          dispatch(getAssessmentByIdAction(assessmentId));
          dispatch(getAssessmentParametersAction(assessmentId));

          // Drop local selections now that the server holds the authoritative
          // (deduped) allocation — otherwise getCurrentAssignments would keep
          // preferring this stale local copy over the fresh server data.
          dispatch(setSelectAllParameter([]));
          dispatch(resetBulkAssignParametersState());
          navigation.goBack();
        }, 2000);
      }
    })();
  }, [assessmentParametersLoading, bulkAssignParametersLoading]);

  // The server rejected the allocation (validation / lock). Surface the
  // per-assessor messages, clear the error, and re-pull authoritative
  // parameters so any rejected local edits are corrected. No success modal,
  // no lock, no navigation — the lead stays here to fix the allocation.
  useEffect(() => {
    if (!bulkAssignParametersError) {
      return;
    }
    const data = bulkAssignParametersError;
    const messages = Array.isArray(data?.errors) ? data.errors : [];
    const body = messages.length
      ? messages.join('\n')
      : (typeof data === 'string' ? data : data?.message) ||
        'Could not save the allocation. Review the assignments and try again.';
    Alert.alert('Allocation not saved', body);
    dispatch(resetBulkAssignParametersState());
    dispatch(getAssessmentParametersAction(assessmentId));
  }, [bulkAssignParametersError]);

  // Generate assignments object: { parameterId: assignedToTeamMemberId }
  const getSavedAssignments = () =>
    [
      ...(assessmentParameters?.mandatoryParameters || []),
      ...(assessmentParameters?.optionalParameters || [])
    ]
      .filter((param) => param.assignedToTeamMemberId != null)
      .map((param) => ({
        parameterId: param.id,
        teamMemberId: param.assignedToTeamMemberId,
        assessmentId
      }));

  const getCurrentAssignments = () => {
    const localForAssessment = (selectAllParameter || []).filter(
      (item) => String(item.assessmentId) === String(assessmentId)
    );
    return localForAssessment.length > 0 ? localForAssessment : getSavedAssignments();
  };

  const getParameterAssignments = () => {
    const val = getCurrentAssignments();
    if (!val || val.length === 0) {
      return [];
    }

    // Check all have the same assessmentId
    const firstAssessmentId = val[0]?.assessmentId;
    const allSameAssessmentId = val.every((item) => item.assessmentId === firstAssessmentId);
    if (!allSameAssessmentId) {
      Logger.warn('Not all parameters have the same assessmentId');
    }

    // Build array: [{ parameterId, teamMemberId }]
    const assignments = val
      .filter((item) => item?.parameterId && item?.teamMemberId)
      .map((item) => ({ parameterId: item.parameterId, teamMemberId: item.teamMemberId }));
    return assignments;
  };

  const parameterAssignments = getParameterAssignments();

  // Checks if all mandatory parameters are assigned, or if none, at least one optional parameter is selected
  const areAllParametersSelected = () => {
    const mandatory = assessmentParameters?.mandatoryParameters || [];
    const optional = assessmentParameters?.optionalParameters || [];
    const selectedIds = new Set(getCurrentAssignments().map((item) => String(item.parameterId)));

    // If there are mandatory parameters, all must be assigned
    if (mandatory.length > 0) {
      return mandatory.every((param) => selectedIds.has(String(param.id)));
    }
    // If no mandatory, but optional exist, at least one optional must be selected
    if (optional.length > 0) {
      return optional.some((param) => selectedIds.has(String(param.id)));
    }
    // If neither, disable
    return false;
  };
  // Parameters data

  // Calculate assignment stats

  const _getAssessorRoleLabel = (role) => (role === 'lead_assessor' ? 'Lead' : 'Co');

  const handleAssign = (item) => {
    navigation.navigate('SelectParameters', { item: { ...item, assessmentId } });
  };

  const handleSave = async () => {
    setModal(false);
    // Allocation is online-only: it must reach the server before any
    // co-assessor can act on it, so there is no offline save path.
    if (!(await checkInternetConnection())) {
      Alert.alert(
        'You are offline',
        'Parameter allocation needs an internet connection. Reconnect and try again.'
      );
      return;
    }
    const val = {
      assessmentId: assessmentId,
      data: { assignments: parameterAssignments, skipOptionalUnassigned: false }
    };
    Logger.info('Save Payload:', val);
    dispatch(bulkAssignParametersAction(val));
  };
  // Per-assessor parameter count. Takes the member OBJECT, not just an id:
  // matching by membership id alone breaks offline, where the mirrored roster
  // carries no membership id (so member.id falls back to the user id) while
  // each parameter's assignedToTeamMemberId is the server membership id — they
  // never match and every count read 0. Match by the assignee's USER id first
  // (param.assignedTeamMember.user.id, stored online and offline), with the
  // membership-id comparison as the online fallback — mirroring the assessment
  // home screens (ManufacturingLeadAssessment).
  const getCount = (member) => {
    if (!member) {
      return 0;
    }
    // Local unsaved edits exist only in the online allocation flow and key on
    // the membership id, which is valid there. Prefer them so reassignments
    // reflect immediately and carry untouched assessors forward.
    const localForAssessment = (selectAllParameter || []).filter(
      (sel) => String(sel.assessmentId) === String(assessmentId)
    );
    if (localForAssessment.length > 0) {
      return localForAssessment.filter((sel) => String(sel.teamMemberId) === String(member.id))
        .length;
    }
    // Saved allocation: count the parameters whose assignee resolves to this
    // member, by user id (offline-safe) then membership id (online fallback).
    const all = [
      ...(assessmentParameters?.mandatoryParameters || []),
      ...(assessmentParameters?.optionalParameters || [])
    ];
    return all.filter((p) => isParameterAssignedToMember(p, member)).length;
  };

  // Server requires every team member (lead + co-assessors) to hold at least
  // one parameter. Mirror that here so the lead can't submit an allocation the
  // server will reject. getCount combines local selections with saved counts,
  // so this stays correct mid-edit and for untouched assessors alike.
  const everyAssessorHasParameter = () => {
    if (teamMembers.length === 0) {
      return false;
    }
    return teamMembers.every((member) => getCount(member) > 0);
  };

  const renderAssessor = ({ item }) => {
    return (
      <View style={[styles.assessorCard]}>
        <View style={styles.assessorInfo}>
          <UserInitial
            name={`${item.user?.firstName}`}
            lastName={`${item.user?.lastName}`}
            role={item.role}
          />
          <View style={styles.assessorDetails}>
            <Text
              style={[commonStyles.bodyMediumPrimary600, { marginBottom: Responsive.height(2) }]}>
              {item?.user?.firstName} {item.user?.lastName}
            </Text>
            <Text style={[commonStyles.bodySmallTertiary500]}>
              {item.role == 'lead_assessor' ? 'Lead Assessor' : 'Co-Assessor'}
            </Text>
          </View>
        </View>
        <View style={styles.assignmentInfo}>
          {(() => {
            const count = getCount(item);
            // Check if assignments are from API (saved) or local-only (unsaved).
            // Resolve by user id first so this is correct offline (where the
            // membership id is absent), mirroring getCount.
            const mandatory = assessmentParameters?.mandatoryParameters || [];
            const optional = assessmentParameters?.optionalParameters || [];
            const apiCount =
              mandatory.filter((p) => isParameterAssignedToMember(p, item)).length +
              optional.filter((p) => isParameterAssignedToMember(p, item)).length;
            // If count matches API count, it's saved (green); if count > 0 but not saved, it's local (yellow)
            const isSaved = apiCount > 0 && count === apiCount;
            let badgeBg, badgeBorder, badgeTextColor;
            if (count === 0) {
              badgeBg = COLORS.warning.clarity;
              badgeBorder = COLORS.warning.clarity;
              badgeTextColor = COLORS.warning.active;
            } else if (isSaved) {
              badgeBg = COLORS.success.clarity;
              badgeBorder = COLORS.success.clarity;
              badgeTextColor = COLORS.success.primary;
            } else {
              // Local unsaved — yellow
              badgeBg = COLORS.success.clarity;
              badgeBorder = COLORS.success.clarity;
              badgeTextColor = COLORS.success.primary;
            }
            return (
              <View
                style={[
                  styles.assignmentCount,
                  { backgroundColor: badgeBg, borderColor: badgeBorder }
                ]}>
                <Text
                  style={[
                    commonStyles.FontFamily_SemiBold600,
                    { fontSize: FONT_SIZE.fs10, color: badgeTextColor }
                  ]}>
                  {count}
                </Text>
                <Text
                  style={[
                    commonStyles.FontFamily_SemiBold600,
                    { fontSize: FONT_SIZE.fs10, color: badgeTextColor }
                  ]}>
                  Assigned
                </Text>
              </View>
            );
          })()}
          <View style={styles.actionButtons}>
            {isReadOnly ? (
              // Locked (opening meeting completed) or co-assessor → read-only view.
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('AssignedParameters', {
                    item: item,
                    assessmentId: assessmentId
                  })
                }
                activeOpacity={0.6}
                style={styles.assignButton}>
                <Text style={styles.assignButtonText}>View</Text>
              </TouchableOpacity>
            ) : (
              // Meeting not complete → lead can still edit. Show "Edit" once
              // THIS assessor has parameters (saved or just-allocated locally),
              // otherwise "Assign". getCount mirrors the badge above so the
              // label and count stay in sync per assessor.
              <TouchableOpacity
                onPress={() => handleAssign(item)}
                activeOpacity={0.6}
                style={styles.assignButton}>
                <Text style={styles.assignButtonText}>
                  {getCount(item) > 0 ? `Edit` : `Assign`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const selectedMandatoryCount =
    getCurrentAssignments().length > 0
      ? assessmentParameters?.mandatoryParameters?.filter((parm) =>
          getCurrentAssignments().some((selParm) => String(selParm.parameterId) === String(parm.id))
        ).length
      : assessmentParameters?.mandatoryParameters?.filter(
          (parm) => parm.assignedToTeamMemberId != null
        ).length;

  const selectedOptionalCount =
    getCurrentAssignments().length > 0
      ? assessmentParameters?.optionalParameters?.filter((parm) =>
          getCurrentAssignments().some((selParm) => String(selParm.parameterId) === String(parm.id))
        ).length
      : assessmentParameters?.optionalParameters?.filter(
          (parm) => parm.assignedToTeamMemberId != null
        ).length;
  return (
    <View style={[commonStyles.fill, { backgroundColor: COLORS.background.primary }]}>
      <Header title="Parameter Allocation" back={true} />
      <AppScrollView style={styles.container}>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {selectedMandatoryCount}
              <Text style={styles.statNumberTotal}>
                /{assessmentParameters?.mandatoryParameters?.length || 0}
              </Text>
            </Text>
            <Text style={styles.statLabel}>Mandatory</Text>
          </View>
          <View
            style={{
              height: Responsive.height(16),
              backgroundColor: COLORS.border.light,
              width: Responsive.width(1)
            }}
          />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {selectedOptionalCount}
              <Text style={styles.statNumberTotal}>
                /{assessmentParameters?.optionalParameters?.length || 0}
              </Text>
            </Text>
            <Text style={styles.statLabel}>Optional</Text>
          </View>
          <View
            style={{
              height: Responsive.height(16),
              backgroundColor: COLORS.border.light,
              width: Responsive.width(1)
            }}
          />
        </View>
        <View style={styles.assessorsSection}>
          <FlatList
            data={(() => {
              if (isCoAssessor) {
                return teamMembers.filter((m) => m?.user?.id === currentUserId);
              }
              const leadAssessor = teamMembers.find((m) => m.role === 'lead_assessor');
              const others = teamMembers.filter((m) => m.role !== 'lead_assessor');
              return leadAssessor ? [leadAssessor, ...others] : others;
            })()}
            renderItem={renderAssessor}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: Responsive.height(1),
                  backgroundColor: COLORS.border.light,
                  marginVertical: Responsive.height(16)
                }}
              />
            )}
            scrollEnabled={false}
          />
        </View>
        <AppCommonModal
          showmodal={successModal}
          imgsrc={Icons.success}
          title="Parameters Allocated"
          subTitle="Parameter Allocated Successfully."
        />
      </AppScrollView>
      {isAllocationLocked && isLead && (
        <View style={styles.warningContainer}>
          <Image source={Icons.warningIcon} style={[commonStyles.iconSize18]} />
          <Text style={styles.warningText}>
            Parameter allocation is locked once saved and can no longer be edited.
          </Text>
        </View>
      )}
      {!isReadOnly &&
        assessmentParameters?.mandatoryParameters?.filter(
          (param) => param.assignedToTeamMemberId == null
        )?.length > 0 &&
        selectedMandatoryCount !== assessmentParameters?.mandatoryParameters?.length && (
          <View style={styles.warningContainer}>
            <Image source={Icons.warningIcon} style={[commonStyles.iconSize18]} />
            <Text style={styles.warningText}>Assign all the Mandatory Parameters to continue.</Text>
          </View>
        )}
      {!isReadOnly && areAllParametersSelected() && !everyAssessorHasParameter() && (
        <View style={styles.warningContainer}>
          <Image source={Icons.warningIcon} style={[commonStyles.iconSize18]} />
          <Text style={styles.warningText}>
            Assign at least one parameter to every assessor to continue.
          </Text>
        </View>
      )}
      {!isReadOnly &&
        (assessmentParameters?.mandatoryParameters?.length > 0 ||
          assessmentParameters?.optionalParameters?.length > 0) &&
        // Show Save for first-time allocation (nothing assigned yet) OR while
        // editing — i.e. when there are unsaved local changes. The old code
        // only checked assignedCount === 0, so the button vanished the moment
        // anything was assigned, leaving no way to persist edits.
        (!(assessmentParameters?.summary?.assignedCount > 0) ||
          (selectAllParameter && selectAllParameter.length > 0)) && (
          <View style={styles.bottomButtonContainer}>
            <AppButton
              title="Save Allocation"
              size="large"
              onPress={() => {
                setModal(true);
              }}
              disabled={!areAllParametersSelected() || !everyAssessorHasParameter()}
              style={[
                styles.saveButton,
                (!areAllParametersSelected() ||
                  !everyAssessorHasParameter() ||
                  assessmentParameters?.summary?.unassignedCount > 0) &&
                  styles.disabledButton
              ]}
            />
          </View>
        )}
      <AppCommonModal
        showmodal={modal}
        imgsrc={Images.modalPendingImage}
        title="Complete Parameter Allocation?"
        subTitle="Once saved, this allocation is locked and cannot be edited."
        onPress={() => {
          handleSave();
        }}
        twoButtonModal={true}
        leftButtonText="Cancel"
        leftButtonColor={COLORS.primary.soft}
        LeftbuttonTextColor={COLORS.primary.main}
        rightButtonText="Confirm"
        leftvariant="secondary"
        LeftonPress={() => {
          setModal(false);
        }}
      />
    </View>
  );
};
const styles = {
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background.primary,
    paddingVertical: Responsive.height(12),
    paddingHorizontal: Responsive.width(16),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.regular
    // marginBottom: Responsive.height(2),
  },
  statItem: {
    flex: 1,
    alignItems: 'center'
  },
  statNumber: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs20,
    color: COLORS.text.primary,
    marginBottom: SPACING.sp4
  },
  statNumberTotal: {
    fontSize: FONT_SIZE.fs14
  },
  statLabel: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.secondary
  },
  assessorsSection: {
    backgroundColor: COLORS.background.primary,
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(16)
  },
  assessorCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.br12
  },
  assessorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10
  },
  assessorAvatar: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.br20,
    backgroundColor: COLORS.primary.soft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sp12
  },
  avatarText: {
    color: COLORS.primary.main,
    fontSize: FONT_SIZE.fs16,
    fontWeight: '600'
  },
  assessorDetails: {
    flex: 1
  },
  assignmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sp12
  },
  assignmentCount: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sp2,
    backgroundColor: COLORS.warning.light,
    borderwidth: 1,
    borderColor: COLORS.warning.clarity,
    width: Responsive.width(74),
    height: Responsive.height(20),
    borderRadius: BORDER_RADIUS.br6
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sp8
  },
  assignButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: Responsive.width(8),
    paddingVertical: Responsive.height(4)
  },
  assignButtonText: {
    color: COLORS.primary.main,
    fontSize: FONT_SIZE.fs14,
    ...commonStyles.FontFamily_SemiBold600
  },
  editButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: Responsive.width(8),
    paddingVertical: Responsive.height(4)
  },
  editButtonText: {
    color: COLORS.success.main,
    fontSize: FONT_SIZE.fs14,
    ...commonStyles.FontFamily_SemiBold600
  },
  warningContainer: {
    paddingHorizontal: Platform.select({
      ios: Responsive.width(40),
      android: Responsive.width(20)
    }),
    paddingVertical: Responsive.height(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sp10,
    backgroundColor: COLORS.warning.active,
    ...commonStyles.center
  },
  warningText: {
    ...commonStyles.FontFamily_Bold700,
    color: COLORS.text.white,
    fontSize: FONT_SIZE.fs14
  },
  bottomButtonContainer: {
    backgroundColor: COLORS.background.primary,
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(16)
  },
  saveButton: {
    // Default save button style
  },
  disabledButton: {
    opacity: 0.5
  }
};

export default AllocateParameters;
