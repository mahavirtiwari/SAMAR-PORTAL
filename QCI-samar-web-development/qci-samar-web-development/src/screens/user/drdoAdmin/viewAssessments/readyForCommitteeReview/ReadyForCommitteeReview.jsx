import AssessmentsListPage from '../../../../../components/assessments/AssessmentsListPage';
import { ASSESSMENT_STAGES } from '../../../../../components/assessments/assessmentStages';

const ReadyForCommitteeReview = () => <AssessmentsListPage {...ASSESSMENT_STAGES.readyForCommitteeReview} />;

export default ReadyForCommitteeReview;
