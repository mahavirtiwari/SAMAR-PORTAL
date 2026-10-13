import AccountService from './accountService';
import AssessmentService from './assessment';
import AssessmentParameterService from './assessmentParameterService';
import AssessmentResponse from './assessmentResponse';
import BasicInformationService from './basicInformationService';
import PublicClient from './clients/publicClient';
import userClient from './clients/userClient';
import MeetingService from './meetingService';
import SiteService from './siteService';

const Api = {
  CommonApi: AccountService(PublicClient),
  AssessmentApi: AssessmentService(userClient),
  BasicInformationApi: BasicInformationService(userClient),
  MeetingApi: MeetingService(userClient),
  SiteApi: SiteService(userClient),
  AssessmentParameterApi: AssessmentParameterService(userClient),
  AssessmentResponseApi: AssessmentResponse(userClient)
};

export default Api;
