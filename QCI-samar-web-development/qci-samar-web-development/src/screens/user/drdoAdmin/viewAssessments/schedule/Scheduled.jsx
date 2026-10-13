import AssessmentsListPage from '../../../../../components/assessments/AssessmentsListPage';
import { ASSESSMENT_STAGES } from '../../../../../components/assessments/assessmentStages';

const Scheduled = () => <AssessmentsListPage {...ASSESSMENT_STAGES.scheduled} />;

export default Scheduled;
