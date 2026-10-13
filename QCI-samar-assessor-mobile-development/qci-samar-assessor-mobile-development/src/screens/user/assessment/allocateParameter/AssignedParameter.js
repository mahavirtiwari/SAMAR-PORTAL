import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { COLORS } from '../../../../assets/theme/Theme';
import { Header } from '../../../../components/layout';
import ScreenLoader from '../../../../components/shared/ScreenLoader';
import {
  getAssessmentParametersAction,
  getMyAssessmentsAction
} from '../../../../redux/action/assessmentParameterAction';
import { isParameterAssignedToMember } from '../../../../utils/teamRole';

const AssignedParameters = ({ route }) => {
  const navigation = useNavigation();
  const { item, assessmentId } = route.params;
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getMyAssessmentsAction(assessmentId));
    dispatch(getAssessmentParametersAction(assessmentId));
  }, []);
  const { assessmentParameters, assessmentParametersError } = useSelector(
    (state) => state.assessmentParameter
  );

  // Match assignments by the assignee's user id first so the list and count
  // render offline, where the mirrored roster carries no membership id (so
  // item.id is the user id, not the server membership id assignedToTeamMemberId
  // holds). See isParameterAssignedToMember.
  const assignedMandatory = (assessmentParameters?.mandatoryParameters || []).filter((p) =>
    isParameterAssignedToMember(p, item)
  );
  const assignedOptional = (assessmentParameters?.optionalParameters || []).filter((p) =>
    isParameterAssignedToMember(p, item)
  );
  const getCount = () => assignedMandatory.length + assignedOptional.length;

  // Until the parameters first arrive, show the loader instead of the assessor
  // card rendering "0 Assigned" with empty sections behind the load. Gate on
  // "no data yet" (not the loading flag) so a background re-fetch — the mount
  // dispatch above, when the parent already loaded this assessment — keeps the
  // list on screen instead of flashing the loader back over it. Errors fall
  // through so the screen never spins forever.
  if (!assessmentParameters && !assessmentParametersError) {
    return (
      <View style={styles.container}>
        <Header title="Assigned Parameters" close={true} onPress={() => navigation.goBack()} />
        <ScreenLoader />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Header title="Assigned Parameters" close={true} onPress={() => navigation.goBack()} />
      <View style={{ padding: 16, flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled">
          {/* Assessor Card */}
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item?.user?.firstName?.charAt(0)}
                {item?.user?.lastName?.charAt(0)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {item?.user?.firstName} {item?.user?.lastName}
              </Text>
              <Text style={styles.role}>
                {item?.role == 'lead_assessor' ? 'Lead Assessor' : 'Co-Assessor'}
              </Text>
            </View>
            <Text style={styles.count}>
              {' '}
              {getCount()}
              <Text style={styles.assigned}> Assigned</Text>
            </Text>
          </View>
          {/* Mandatory */}
          {assignedMandatory.length > 0 && (
            <View>
              <Text style={styles.sectionTitle}>
                Mandatory Parameters ({assignedMandatory.length})
              </Text>
              <View style={{ marginTop: 8 }}>
                {assignedMandatory.map((parm, index) => (
                  <View key={index} style={styles.row}>
                    <Text style={styles.index}>{String(index + 1).padStart(2, '0')}</Text>
                    <Text style={styles.itemText}>{parm?.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {assignedOptional.length > 0 && assignedMandatory.length > 0 && (
            <View style={styles.divider} />
          )}
          {assignedOptional.length > 0 && (
            <View>
              {/* Optional */}
              <Text style={styles.sectionTitle}>
                Optional Parameters ({assignedOptional.length})
              </Text>
              <View style={{ marginTop: 8 }}>
                {assignedOptional.map((parm, index) => (
                  <View key={index} style={styles.row}>
                    <Text style={styles.index}>{String(index + 1).padStart(2, '0')}</Text>
                    <Text style={styles.itemText}>{parm?.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    justifyContent: 'space-between'
  },
  close: {
    fontSize: 22,
    color: '#222'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1C'
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F7FB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E6DEFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#7239EA'
  },
  avatarText: {
    color: '#6C4DFF',
    fontWeight: '700'
  },
  name: {
    fontSize: 15,
    fontWeight: '600'
  },
  role: {
    fontSize: 12,
    color: '#777'
  },
  assigned: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.tertiary
  },

  count: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.primary
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8
  },
  row: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center'
  },
  index: {
    width: 28,
    fontSize: 13,
    fontWeight: '600',
    color: '#9AA0A6'
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    color: '#1F1F1F'
  },
  divider: {
    height: 1,
    backgroundColor: '#EEE',
    marginVertical: 12
  }
});

export default AssignedParameters;
