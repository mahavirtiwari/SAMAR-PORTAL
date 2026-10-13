import AssessmentsListPage from '../../../../../components/assessments/AssessmentsListPage';
import { ASSESSMENT_STAGES } from '../../../../../components/assessments/assessmentStages';

const QualityCheck = () => <AssessmentsListPage {...ASSESSMENT_STAGES.qualityCheck} />;

export default QualityCheck;
