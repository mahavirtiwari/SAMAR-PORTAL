import { useNavigation } from '@react-navigation/native';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../../../assets/theme/Theme';
import { AppButton } from '../../../../components';
import { Header } from '../../../../components/layout';
import AppScrollView from '../../../../components/shared/AppScrollView';
import Icons from '../../../../constants/Icons';
import { setSelectAllParameter } from '../../../../redux/slices/assessmentParameterSlice';
import { Logger } from '../../../../utils';

const SelectParameters = ({ route }) => {
  const { item } = route.params;
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const { assessmentParameters, selectAllParameter } = useSelector(
    (state) => state.assessmentParameter
  );

  // State for all selected parameters (mandatory and optional)
  const [selectedParameters, setSelectedParameters] = useState([]);
  const [_successModal, _setSuccessModal] = useState(false);
  // Helper to get team member id
  const teamMemberId = item?.id;
  const assessorRoleLabel = item?.role === 'lead_assessor' ? 'Lead Assessor' : 'Co-Assessor';

  // The assessor being edited is the lead, and the team has no co-assessor.
  // In that case every mandatory parameter belongs to the lead by default.
  const isLeadAssessor = item?.role === 'lead_assessor';
  const hasCoAssessor = (assessmentParameters?.teamMembers || []).some(
    (member) => member?.role !== 'lead_assessor'
  );
  // When the lead is the only assessor, mandatory parameters are auto-assigned
  // to them and locked — they can't be deselected.
  const mandatoryAutoSelected = isLeadAssessor && !hasCoAssessor;

  const getSavedAssignments = () =>
    [
      ...(assessmentParameters?.mandatoryParameters || []),
      ...(assessmentParameters?.optionalParameters || [])
    ]
      .filter((param) => param.assignedToTeamMemberId != null)
      .map((param) => ({
        parameterId: param.id,
        teamMemberId: param.assignedToTeamMemberId,
        assessmentId: item?.assessmentId
      }));

  const getCurrentAssignments = () => {
    const localForAssessment = (selectAllParameter || []).filter(
      (sel) => String(sel.assessmentId) === String(item?.assessmentId)
    );
    return localForAssessment.length > 0 ? localForAssessment : getSavedAssignments();
  };

  useEffect(() => {
    if (assessmentParameters) {
      // Get all parameter IDs from assessmentParameters
      const allParamIds = new Set(
        [
          ...(assessmentParameters?.mandatoryParameters || []),
          ...(assessmentParameters?.optionalParameters || [])
        ].map((param) => String(param.id))
      );

      // Only keep assignments for the assessor being edited.
      const selected = getCurrentAssignments().filter(
        (sel) =>
          String(sel.teamMemberId) === String(item?.id) && allParamIds.has(String(sel.parameterId))
      );

      // When the team has only a lead (no co-assessor), every mandatory
      // parameter belongs to the lead — default-select any not already chosen.
      if (isLeadAssessor && !hasCoAssessor) {
        const selectedIds = new Set(selected.map((sel) => String(sel.parameterId)));
        const mandatoryDefaults = (assessmentParameters?.mandatoryParameters || [])
          .filter((param) => !selectedIds.has(String(param.id)))
          .map((param) => ({
            parameterId: param.id,
            teamMemberId: item?.id,
            assessmentId: item?.assessmentId
          }));
        setSelectedParameters([...selected, ...mandatoryDefaults]);
        return;
      }

      setSelectedParameters(selected);
    }
  }, [assessmentParameters, selectAllParameter, item?.assessmentId, item?.id]);
  // Toggle selection for any parameter
  const toggleParameter = (parameterId) => {
    setSelectedParameters((prev) => {
      const exists = prev.find(
        (obj) =>
          String(obj.parameterId) === String(parameterId) &&
          String(obj.teamMemberId) === String(teamMemberId)
      );
      if (exists) {
        return prev.filter(
          (obj) =>
            !(
              String(obj.parameterId) === String(parameterId) &&
              String(obj.teamMemberId) === String(teamMemberId)
            )
        );
      } else {
        return [...prev, { parameterId, teamMemberId, assessmentId: item?.assessmentId }];
      }
    });
  };

  const SelectedParamtersHandler = async () => {
    Logger.info('Allocating parameters with payload:', selectedParameters);
    // Drop this user's previous entries AND any other user's entry for a
    // parameter this user just selected — selecting a taken parameter REASSIGNS
    // it (a parameter can belong to only one assessor) rather than duplicating.
    const selectedIds = new Set(selectedParameters.map((sel) => String(sel.parameterId)));
    const otherAssessmentAssignments = (selectAllParameter || []).filter(
      (sel) => String(sel.assessmentId) !== String(item?.assessmentId)
    );
    const filtered = getCurrentAssignments().filter(
      (sel) =>
        String(sel.teamMemberId) !== String(teamMemberId) &&
        !selectedIds.has(String(sel.parameterId))
    );
    // Merge with current selectedParameters for this user
    const merged = [...otherAssessmentAssignments, ...filtered, ...selectedParameters];
    await dispatch(setSelectAllParameter(merged));
    navigation.goBack();
  };

  const renderMandatoryParameterItem = ({ item, index }) => {
    const isSelected = selectedParameters.some(
      (obj) => String(obj.parameterId) === String(item.id)
    );
    const takenBy = isSelected ? null : getOtherOwnerName(item.id);
    return (
      <TouchableOpacity
        activeOpacity={0.6}
        disabled={mandatoryAutoSelected}
        onPress={() => toggleParameter(item.id)}
        style={[styles.parameterItem, mandatoryAutoSelected && { opacity: 0.6 }]}>
        <View style={[styles.parameterContent]}>
          <Text style={styles.parameterNumber}>{String(index + 1).padStart(2, '0')}</Text>
          <View style={commonStyles.fill}>
            <Text style={[commonStyles.bodyMediumPrimary500]}>{item.name}</Text>
            {takenBy && (
              <Text style={{ fontSize: 12, color: COLORS.text.tertiary, marginTop: 2 }}>
                Assigned to {takenBy}
              </Text>
            )}
          </View>
        </View>
        <View>
          <Image
            source={isSelected ? Icons.radioChecked : Icons.radioUnchecked}
            style={[commonStyles.iconSize24]}
          />
        </View>
      </TouchableOpacity>
    );
  };

  // True when this parameter is currently assigned to a DIFFERENT assessor than
  // the one being edited (unassigned or self-assigned → false).
  const isAssignedToOther = (parameterId) =>
    getCurrentAssignments().some(
      (sel) =>
        String(sel.parameterId) === String(parameterId) &&
        String(sel.teamMemberId) !== String(teamMemberId)
    );

  // Show only parameters available to the assessor being edited: unassigned or
  // already theirs. Parameters held by ANY other assessor are hidden — this
  // applies to the lead too, so the lead sees their own parameters, not the
  // co-assessor's.
  const getParamenterSelective = (params) => {
    if (!Array.isArray(params)) {
      return [];
    }
    return params.filter((param) => !isAssignedToOther(param.id));
  };

  // First name of another assessor this parameter is currently assigned to, or
  // null when it's unassigned or assigned to the assessor being edited.
  const getOtherOwnerName = (parameterId) => {
    const owner = getCurrentAssignments().find(
      (sel) =>
        String(sel.parameterId) === String(parameterId) &&
        String(sel.teamMemberId) !== String(teamMemberId)
    );
    if (!owner) {
      return null;
    }
    const member = (assessmentParameters?.teamMembers || []).find(
      (m) => String(m.id) === String(owner.teamMemberId)
    );
    return member?.name || 'another assessor';
  };

  const renderOptionalParameterItem = ({ item, index }) => {
    const isSelected = selectedParameters.some(
      (obj) => String(obj.parameterId) === String(item.id)
    );
    const takenBy = isSelected ? null : getOtherOwnerName(item.id);
    return (
      <TouchableOpacity
        onPress={() => toggleParameter(item.id)}
        activeOpacity={0.6}
        style={styles.parameterItem}>
        <View style={styles.parameterContent}>
          <Text style={styles.parameterNumber}>{String(index + 1).padStart(2, '0')}</Text>
          <View style={commonStyles.fill}>
            <Text style={[commonStyles.bodyMediumPrimary500]}>{item.name}</Text>
            {takenBy && (
              <Text style={{ fontSize: 12, color: COLORS.text.tertiary, marginTop: 2 }}>
                Assigned to {takenBy}
              </Text>
            )}
          </View>
        </View>
        <View>
          <Image
            source={isSelected ? Icons.radioChecked : Icons.radioUnchecked}
            style={[commonStyles.iconSize24]}
          />
        </View>
      </TouchableOpacity>
    );
  };

  // Only the parameters available to the assessor being edited (unassigned or
  // already theirs). Headings/sections are hidden when their list is empty.
  const visibleMandatoryParameters = getParamenterSelective(
    assessmentParameters?.mandatoryParameters
  );
  const visibleOptionalParameters = getParamenterSelective(
    assessmentParameters?.optionalParameters
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.modalContainer}>
        <Header title="Select Parameters" close={true} onPress={() => navigation.goBack()} />
        <View style={styles.assessorInfoCard}>
          <View style={styles.assessorAvatar}>
            <Text style={styles.avatarText}>{item?.user?.firstName?.charAt?.(0) ?? ''}</Text>
          </View>
          <View style={styles.assessorDetailsModal}>
            <Text style={styles.assessorNameModal}>{item?.user?.firstName ?? ''}</Text>
            <Text style={styles.assessorRoleModal}>{assessorRoleLabel}</Text>
          </View>
          <View style={styles.assignedBadge}>
            <Text style={styles.assignedBadgeText}>{selectedParameters?.length} Assigned</Text>
          </View>
        </View>
        <AppScrollView style={styles.modalContent}>
          {visibleMandatoryParameters.length > 0 && (
            <View style={styles.parameterSection}>
              <Text style={styles.sectionTitleModal}>
                Mandatory Parameters ({visibleMandatoryParameters.length})
              </Text>
              <FlatList
                data={visibleMandatoryParameters}
                renderItem={renderMandatoryParameterItem}
                keyExtractor={(item) => `mandatory-${item.id}`}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: Responsive.height(12) }} />}
                contentContainerStyle={{ paddingTop: Responsive.height(16) }}
              />
            </View>
          )}
          {visibleMandatoryParameters.length > 0 && visibleOptionalParameters.length > 0 && (
            <View
              style={{
                borderTopWidth: 1,
                paddingTop: Responsive.height(24),
                marginTop: Responsive.height(24),
                borderTopColor: COLORS.border.light
              }}></View>
          )}
          {visibleOptionalParameters.length > 0 && (
            <View style={[styles.parameterSection]}>
              <Text style={styles.sectionTitleModal}>
                Optional Parameters ({visibleOptionalParameters.length})
              </Text>
              <FlatList
                data={visibleOptionalParameters}
                renderItem={renderOptionalParameterItem}
                keyExtractor={(item) => `optional-${item.id}`}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: Responsive.height(12) }} />}
                contentContainerStyle={{ paddingVertical: Responsive.height(16) }}
              />
            </View>
          )}
        </AppScrollView>
        <View style={styles.modalFooter}>
          <AppButton
            title="Allocate Parameter"
            size="large"
            onPress={() => {
              SelectedParamtersHandler();
            }}
            style={styles.allocateButton}
          />
        </View>
      </View>
    </View>
  );
};

const styles = {
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background.primary
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Responsive.width(16),
    paddingTop: Responsive.height(50),
    paddingBottom: Responsive.height(16),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light
  },
  closeButton: {
    padding: SPACING.sp8
  },
  closeIcon: {
    width: Responsive.width(18),
    height: Responsive.height(18),
    tintColor: COLORS.text.tertiary
  },
  modalTitle: {
    fontSize: FONT_SIZE.fs18,
    fontWeight: '600',
    color: COLORS.text.heading
  },
  headerSpacer: {
    width: Responsive.width(34)
  },
  assessorInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background.secondary,
    borderWidth: 1,
    borderColor: COLORS.background.accent,
    borderRadius: BORDER_RADIUS.br10,
    height: Responsive.height(56),
    marginHorizontal: Responsive.width(16),
    paddingHorizontal: Responsive.width(10),
    paddingVertical: Responsive.height(12),
    marginTop: Responsive.height(16),
    marginBottom: Responsive.height(24)
  },
  assessorAvatar: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.br20,
    backgroundColor: COLORS.primary.soft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sp8
  },
  avatarText: {
    color: COLORS.primary.main,
    fontSize: FONT_SIZE.fs16,
    fontWeight: '600'
  },
  assessorDetailsModal: {
    flex: 1
  },
  assessorNameModal: {
    fontSize: FONT_SIZE.fs14,
    fontWeight: '600',
    color: COLORS.text.primary
  },
  assessorRoleModal: {
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.tertiary,
    marginTop: SPACING.sp2
  },
  assignedBadge: {
    borderWidth: 1,
    borderColor: COLORS.warning.clarity,
    backgroundColor: COLORS.warning.light,
    paddingHorizontal: Responsive.width(12),
    paddingVertical: Responsive.height(4),
    borderRadius: BORDER_RADIUS.br4
  },
  assignedBadgeText: {
    fontSize: FONT_SIZE.fs12,
    color: COLORS.warning.active,
    fontWeight: '600'
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: Responsive.width(16)
  },
  sectionTitleModal: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.primary
  },
  parameterContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1
  },
  parameterNumber: {
    ...commonStyles.FontFamily_Bold700,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.placeholder,
    minWidth: Responsive.width(22),
    paddingTop: Responsive.height(1)
  },
  parameterText: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    flex: 1,
    ...commonStyles.FontFamily_Medium500
  },
  modalFooter: {
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(16),
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light
  },
  parameterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  checkbox: {
    width: Responsive.width(24),
    height: Responsive.height(24),
    borderRadius: Responsive.width(12),
    borderWidth: 2,
    borderColor: COLORS.border.regular,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary.main,
    borderColor: COLORS.primary.main
  },
  checkmark: {
    color: COLORS.text.white,
    fontSize: FONT_SIZE.fs14,
    fontWeight: '600'
  },
  allocateButton: {
    marginTop: 0
  },
  parameterSection: {
    // marginBottom: SPACING.sp8
  }
};

SelectParameters.propTypes = {
  selectedAssessor: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    role: PropTypes.string
  }),
  mandatoryParameters: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string
    })
  ),
  optionalParameters: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string
    })
  ),
  tempSelectedParameters: PropTypes.shape({
    mandatory: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
    optional: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number]))
  }),
  setTempSelectedParameters: PropTypes.func,
  onAllocateParameters: PropTypes.func,
  onClose: PropTypes.func,
  getAssignmentCount: PropTypes.func,
  isEditMode: PropTypes.bool
};

export default SelectParameters;
