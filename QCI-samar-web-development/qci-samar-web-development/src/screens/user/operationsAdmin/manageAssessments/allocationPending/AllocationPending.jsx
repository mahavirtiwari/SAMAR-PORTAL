import AssessmentsListPage from '../../../../../components/assessments/AssessmentsListPage';
import { ASSESSMENT_STAGES } from '../../../../../components/assessments/assessmentStages';

const AllocationPending = () => <AssessmentsListPage {...ASSESSMENT_STAGES.allocationPending} />;

export default AllocationPending;
