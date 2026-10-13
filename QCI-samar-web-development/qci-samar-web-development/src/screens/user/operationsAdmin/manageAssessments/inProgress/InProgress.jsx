import AssessmentsListPage from '../../../../../components/assessments/AssessmentsListPage';
import { ASSESSMENT_STAGES } from '../../../../../components/assessments/assessmentStages';

const InProgress = () => <AssessmentsListPage {...ASSESSMENT_STAGES.inProgress} />;

export default InProgress;
