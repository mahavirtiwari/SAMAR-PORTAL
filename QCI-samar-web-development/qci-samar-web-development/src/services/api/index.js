import PublicClient from './clients/publicClient';
import userClient from './clients/userClient';
import AccountService from './common/AccountService';
import ApplicationAssessmentService from './common/ApplicationAssessmentService';
import ApplicationExportService from './common/ApplicationExportService';
import ApplicationFeedbackService from './common/ApplicationFeedbackService';
import SystemAdminAssessmentService from './common/AssessmentService';
import AssessorOffTimeService from './common/AssessorOffTimeService';
import UserService from './common/UserService';
import DRDOAdminDashboardService from './drdoAdmin/DashboardService';
import ApplicationServices from './enterpriseAdmin/application/ApplicationServices';
import CertificateService from './enterpriseAdmin/CertificateService';
import EnterpriseAdminDashboardService from './enterpriseAdmin/DashboardService';
import unitServices from './enterpriseAdmin/unit/Unit';
import unitAdminServices from './enterpriseAdmin/unitAdmin/unitAdminServices';
import MasterService from './master/MasterService';
import CommitteeMeetingService from './operationsAdmin/CommitteeMeetingService';
import CommitteeMemberService from './operationsAdmin/CommitteeMemberService';
import OperationsAdminDashboardService from './operationsAdmin/DashboardService';
import OperationsManagerDashboardService from './operationsManager/DashboardService';
import OrganizationsServices from './organizations/OrganizationsServices';
import PaymentService from './payment/PaymentService';
import SystemAdminApplicationServices from './systemAdmin/ApplicationService';
import SystemAdminAssessmentParameterService from './systemAdmin/AssessmentParameterService';
import SystemAdminAuditLogService from './systemAdmin/AuditLogService';
import BrandingAdminService from './systemAdmin/BrandingAdminService';
import ContentBlockAdminService from './systemAdmin/ContentBlockAdminService';
import SystemAdminDashboardService from './systemAdmin/DashboardService';
import SystemAdminDisciplinesService from './systemAdmin/DisciplinesService';
import SystemAdminDocumentService from './systemAdmin/documentService';
import EmailTemplateService from './systemAdmin/EmailTemplateService';
import SystemAdminEnterprisesService from './systemAdmin/EnterprisesService';
import SystemAdminFeeConfigService from './systemAdmin/FeeConfigService';
import SystemAdminFeedbackService from './systemAdmin/FeedbackService';
import SystemAdminIntegrationFailureService from './systemAdmin/IntegrationFailureService';
import MailSettingsService from './systemAdmin/MailSettingsService';
import QuickLinkAdminService from './systemAdmin/QuickLinkAdminService';
import SystemSettingsService from './systemAdmin/SystemSettingsService';
import UnitAdminApplicationServices from './unitAdmin/application/ApplicationService';
import UnitAdminCertificateService from './unitAdmin/CertificateService';
import SystemStatusService from './utils/SystemStatusService';

const Api = {
  Account: AccountService(PublicClient),
  User: UserService(),
  ApplicationAssessment: ApplicationAssessmentService(),
  ApplicationFeedback: ApplicationFeedbackService(),
  ApplicationExport: ApplicationExportService(),
  Certificate: CertificateService(),
  UnitAdminCertificate: UnitAdminCertificateService(),
  DRDOAdminDashboard: DRDOAdminDashboardService(),
  OperationsManagerDashboard: OperationsManagerDashboardService(),
  OperationsAdminDashboard: OperationsAdminDashboardService(),
  Master: MasterService(userClient),
  Unit: unitServices(userClient),
  UnitAdmin: unitAdminServices(userClient),
  Application: ApplicationServices(userClient),
  UnitAdminApplication: UnitAdminApplicationServices(userClient),
  Organizations: OrganizationsServices(userClient),
  Payment: PaymentService(userClient),
  EnterpriseAdminDashboard: EnterpriseAdminDashboardService(),
  SystemAdminApplication: SystemAdminApplicationServices(userClient),
  Assessment: SystemAdminAssessmentService(),
  AssessorOffTime: AssessorOffTimeService(),
  SystemAdminDashboard: SystemAdminDashboardService(),
  SystemAdminDocument: SystemAdminDocumentService(),
  SystemAdminEnterprises: SystemAdminEnterprisesService(),
  SystemAdminFeedback: SystemAdminFeedbackService(),
  SystemAdminFeeConfig: SystemAdminFeeConfigService(),
  SystemAdminDisciplines: SystemAdminDisciplinesService(),
  SystemAdminAssessmentParameter: SystemAdminAssessmentParameterService(),
  SystemAdminAuditLog: SystemAdminAuditLogService(userClient),
  SystemAdminIntegrationFailure: SystemAdminIntegrationFailureService(userClient),
  SystemSettingsService: SystemSettingsService(),
  EmailTemplates: EmailTemplateService(),
  ContentBlockAdmin: ContentBlockAdminService(),
  MailSettings: MailSettingsService(),
  BrandingAdmin: BrandingAdminService(),
  QuickLinkAdmin: QuickLinkAdminService(),
  SystemStatus: SystemStatusService(),
  CommitteeMeeting: CommitteeMeetingService(),
  CommitteeMember: CommitteeMemberService(),
};

export default Api;
