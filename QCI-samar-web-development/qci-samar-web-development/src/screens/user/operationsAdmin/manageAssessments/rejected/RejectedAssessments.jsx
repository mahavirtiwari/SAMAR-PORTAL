import AssessmentsListPage from '../../../../../components/assessments/AssessmentsListPage';
import { ASSESSMENT_STAGES } from '../../../../../components/assessments/assessmentStages';

const RejectedAssessments = () => <AssessmentsListPage {...ASSESSMENT_STAGES.rejected} />;

export default RejectedAssessments;
