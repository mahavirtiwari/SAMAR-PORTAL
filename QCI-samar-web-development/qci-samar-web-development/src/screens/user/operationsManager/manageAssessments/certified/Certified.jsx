import AssessmentsListPage from '../../../../../components/assessments/AssessmentsListPage';
import { ASSESSMENT_STAGES } from '../../../../../components/assessments/assessmentStages';

const Certified = () => <AssessmentsListPage {...ASSESSMENT_STAGES.certified} />;

export default Certified;
