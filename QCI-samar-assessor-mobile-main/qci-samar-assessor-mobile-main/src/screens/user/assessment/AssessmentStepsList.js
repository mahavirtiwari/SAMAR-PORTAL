import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { commonStyles } from '../../../assets/theme/Styles';
import AppEmptyState from '../../../components/base/AppEmptyState';
import { Header } from '../../../components/layout';
import ScreenLoader from '../../../components/shared/ScreenLoader';
import Images from '../../../constants/Images';
import {
  getAllAssessmentsAction,
  getAssessmentByIdAction
} from '../../../redux/action/assessmentAction';
import { clearRescheduledFlag } from '../../../redux/slices/assessmentSlice';
import { resolveTeamRole } from '../../../utils/teamRole';
import ManufacturingCoAssessment from './manufacturing/ManufacturingCoAssessment';
import ManufacturingLeadAssessment from './manufacturing/ManufacturingLeadAssessment';
import ServiceCoAssessment from './service/ServiceCoAssessment';
import ServiceLeadAssessment from './service/ServiceLeadAssessment';

const AssessmentStepsList = ({ route }) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { assessmentId } = route.params || {};
  const { userData } = useSelector((state) => state.account);
  const { allAssessments, assessmentData, assessmentDataLoading, rescheduledAssessmentId } =
    useSelector((state) => state.assessment);
  // Counts resolve attempts rather than tracking a boolean: retry has to be
  // able to re-run the fetch after one has already failed, and a flag that only
  // goes one way cannot express that.
  const [resolveAttempt, setResolveAttempt] = useState(0);

  // A schedule change wiped and re-hydrated this assessment's local data
  // (assessmentAction → assessmentSlice). The captured work no longer matches
  // the new schedule, so bounce the assessor back to Home, which refreshes its
  // list on focus. Clear the flag first so re-opening any assessment doesn't
  // re-trigger the bounce.
  useEffect(() => {
    if (rescheduledAssessmentId != null) {
      dispatch(clearRescheduledFlag());
      navigation.popToTop();
    }
  }, [rescheduledAssessmentId, dispatch, navigation]);

  const assessment =
    (allAssessments || []).find((a) => Number(a?.id) === Number(assessmentId)) ||
    (assessmentData?.assessment && Number(assessmentData.assessment.id) === Number(assessmentId)
      ? assessmentData.assessment
      : null);

  const { isLead, isTeamMember } = resolveTeamRole(assessment, userData?.user?.id);
  const sector = assessment?.application?.sector;

  const resolveAssessment = useCallback(() => {
    dispatch(getAllAssessmentsAction());
    dispatch(getAssessmentByIdAction(assessmentId));
  }, [dispatch, assessmentId]);

  useEffect(() => {
    if (!assessment) {
      resolveAssessment();
    }
    // resolveAttempt re-runs this on an explicit Retry; `assessment` is
    // deliberately not a dependency, so a fetch that returns nothing does not
    // loop straight back into another fetch.
  }, [assessmentId, resolveAttempt]);

  // Nothing to show yet. Previously every one of these cases rendered a bare
  // header — no loader, no message, no way forward — which is indistinguishable
  // from a screen that refuses to open, and is exactly how the punch-out gate
  // was reported to us. Say which case it is and offer the way out.
  if (!assessment || !isTeamMember) {
    const stillLoading = !assessment && assessmentDataLoading;
    return (
      <View style={[commonStyles.fill, commonStyles.backgroundColor]}>
        <Header title="Assessment" back={true} />
        {stillLoading ? (
          <ScreenLoader />
        ) : assessment ? (
          <AppEmptyState
            EmptyImage={Images.emptyStateGateImage}
            heading="You are not on this assessment"
            subHeading="This assessment is no longer assigned to you. Go back and pull down to refresh your list."
            button={true}
            content="Back to assessments"
            onPress={() => navigation.popToTop()}
          />
        ) : (
          <AppEmptyState
            EmptyImage={Images.emptyStateGateImage}
            heading="Could not open this assessment"
            subHeading="We could not load it just now. Check your connection and try again — anything you have already captured on this device is safe."
            button={true}
            content="Try again"
            onPress={() => setResolveAttempt((attempt) => attempt + 1)}
          />
        )}
      </View>
    );
  }

  const Page =
    sector === 'service'
      ? isLead
        ? ServiceLeadAssessment
        : ServiceCoAssessment
      : isLead
        ? ManufacturingLeadAssessment
        : ManufacturingCoAssessment;

  return <Page route={route} />;
};

export default AssessmentStepsList;
