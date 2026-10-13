import AssessmentsListPage from '../../../../../components/assessments/AssessmentsListPage';
import { ALLOCATION_PENDING_WITH_SECTOR_FILTERS, ASSESSMENT_STAGES } from '../../../../../components/assessments/assessmentStages';

const AllocationPending = () => <AssessmentsListPage {...ASSESSMENT_STAGES.allocationPending} filters={ALLOCATION_PENDING_WITH_SECTOR_FILTERS} />;

export default AllocationPending;
