import { lazy } from 'react';

//public
export const CertifiedEnterprise = lazy(() => import('./public/CertifiedEnterprise'));
export const ForgotPassword = lazy(() => import('./public/ForgotPassword'));
export const Login = lazy(() => import('./public/Login'));
export const Maintenance = lazy(() => import('./public/Maintenance'));
export const NewPassword = lazy(() => import('./public/NewPassword'));
export const PasswordResetLink = lazy(() => import('./public/PasswordResetLink'));
export const PrivacyPolicy = lazy(() => import('./public/PrivacyPolicy'));
export const Register = lazy(() => import('./public/Register'));
export const VerifyCertificate = lazy(() => import('./public/VerifyCertificate'));
export const AssessorCertifiedAssessmentDetails = lazy(() => import('./user/assessor/manageAssessments/certified/assessmentDetails/AssessmentDetails'));
// coAssessor
export const AssessorCertifiedAssessmentParameterDetails = lazy(() => import('./user/assessor/manageAssessments/certified/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'));
export const AssessorCertified = lazy(() => import('./user/assessor/manageAssessments/certified/Certified'));
export const AssessorCommitteeReviewFeedbackAssessmentDetails = lazy(() => import('./user/assessor/manageAssessments/committeeReviewFeedback/assessmentDetails/AssessmentDetails'));
export const AssessorCommitteeReviewFeedbackAssessmentParameterDetails = lazy(
  () => import('./user/assessor/manageAssessments/committeeReviewFeedback/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const AssessorCommitteeReviewFeedback = lazy(() => import('./user/assessor/manageAssessments/committeeReviewFeedback/CommitteeReviewFeedback'));
export const AssessorCommitteeReviewScheduledAssessmentDetails = lazy(() => import('./user/assessor/manageAssessments/committeeReviewScheduled/assessmentDetails/AssessmentDetails'));
export const AssessorCommitteeReviewScheduledAssessmentParameterDetails = lazy(
  () => import('./user/assessor/manageAssessments/committeeReviewScheduled/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const AssessorCommitteeReviewScheduled = lazy(() => import('./user/assessor/manageAssessments/committeeReviewScheduled/CommitteeReviewScheduled'));
export const AssessorProgressAssessmentDetails = lazy(() => import('./user/assessor/manageAssessments/inProgress/assessmentDetails/AssessmentDetails'));
export const AssessorInProgressAssessmentParameterDetails = lazy(() => import('./user/assessor/manageAssessments/inProgress/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'));
export const AssessorInProgress = lazy(() => import('./user/assessor/manageAssessments/inProgress/InProgress'));
export const AssessorQualityCheckAssessmentDetails = lazy(() => import('./user/assessor/manageAssessments/qualityCheck/assessmentDetails/AssessmentDetails'));
export const AssessorQualityCheckAssessmentParameterDetails = lazy(
  () => import('./user/assessor/manageAssessments/qualityCheck/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const AssessorQualityCheck = lazy(() => import('./user/assessor/manageAssessments/qualityCheck/QualityCheck'));
export const AssessorQualityCheckFeedbackAssessmentDetails = lazy(() => import('./user/assessor/manageAssessments/qualityCheckFeedback/assessmentDetails/AssessmentDetails'));
export const AssessorQualityCheckFeedbackAssessmentParameterDetails = lazy(
  () => import('./user/assessor/manageAssessments/qualityCheckFeedback/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const AssessorQualityCheckFeedback = lazy(() => import('./user/assessor/manageAssessments/qualityCheckFeedback/QualityCheckFeedback'));
export const AssessorReadyForCommitteeReviewAssessmentDetails = lazy(() => import('./user/assessor/manageAssessments/readyForCommitteeReview/assessmentDetails/AssessmentDetails'));
export const AssessorReadyForCommitteeReviewAssessmentParameterDetails = lazy(
  () => import('./user/assessor/manageAssessments/readyForCommitteeReview/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const AssessorReadyForCommitteeReview = lazy(() => import('./user/assessor/manageAssessments/readyForCommitteeReview/ReadyForCommitteeReview'));
export const AssessorScheduledAssessmentDetails = lazy(() => import('./user/assessor/manageAssessments/schedule/assessmentDetails/AssessmentDetails'));
export const AssessorScheduled = lazy(() => import('./user/assessor/manageAssessments/schedule/Scheduled'));
export const SetUnavailability = lazy(() => import('./user/assessor/setUnavailability/SetUnavailability'));
export const DRDOApplications = lazy(() => import('./user/drdoAdmin/applications/Application'));
export const DRDOApplicationsDetails = lazy(() => import('./user/drdoAdmin/applications/ApplicationDetails'));
export const DRDOCertifiedVendorsDetails = lazy(() => import('./user/drdoAdmin/certifiedVendors/ApplicationDetails'));
export const DRDOCertifiedVendors = lazy(() => import('./user/drdoAdmin/certifiedVendors/CertifiedVendors'));
export const DRDOAdminDashboard = lazy(() => import('./user/drdoAdmin/Dashboard'));
export const DRDOPaymentDetails = lazy(() => import('./user/drdoAdmin/paymentHistory/PaymentHistory'));
export const DRDOPendingApprovalsDetails = lazy(() => import('./user/drdoAdmin/pendingApprovals/ApplicationDetails'));
export const DRDOPendingApprovals = lazy(() => import('./user/drdoAdmin/pendingApprovals/PendingApprovals'));
export const DrdoAdminActiveApplications = lazy(() => import('./user/drdoAdmin/status/ActiveApplications'));
export const DrdoAdminApplicationStatus = lazy(() => import('./user/drdoAdmin/status/ApplicationStatus'));
export const DrdoAdminInProgressApplications = lazy(() => import('./user/drdoAdmin/status/InProgressApplications'));
export const DrdoAdminPaymentPendingApplications = lazy(() => import('./user/drdoAdmin/status/PaymentPendingApplications'));
export const DrdoAdminPendingApplications = lazy(() => import('./user/drdoAdmin/status/PendingApplications'));
export const DrdoAdminAllocationPending = lazy(() => import('./user/drdoAdmin/viewAssessments/allocationPending/AllocationPending'));
export const DrdoAdminAllocationPendingDetails = lazy(() => import('./user/drdoAdmin/viewAssessments/allocationPending/AllocationPendingDetails'));
export const DrdoAdminCertifiedAssessmentDetails = lazy(() => import('./user/drdoAdmin/viewAssessments/certified/assessmentDetails/AssessmentDetails'));
export const DrdoAdminCertifiedAssessmentParameterDetails = lazy(() => import('./user/drdoAdmin/viewAssessments/certified/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'));
export const DrdoAdminCertified = lazy(() => import('./user/drdoAdmin/viewAssessments/certified/Certified'));
export const DrdoAdminCommitteeReviewFeedbackAssessmentDetails = lazy(() => import('./user/drdoAdmin/viewAssessments/committeeReviewFeedback/assessmentDetails/AssessmentDetails'));
export const DrdoAdminCommitteeReviewFeedbackAssessmentParameterDetails = lazy(
  () => import('./user/drdoAdmin/viewAssessments/committeeReviewFeedback/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const DrdoAdminCommitteeReviewFeedback = lazy(() => import('./user/drdoAdmin/viewAssessments/committeeReviewFeedback/CommitteeReviewFeedback'));
export const DrdoAdminCommitteeReviewScheduledAssessmentDetails = lazy(() => import('./user/drdoAdmin/viewAssessments/committeeReviewScheduled/assessmentDetails/AssessmentDetails'));
export const DrdoAdminCommitteeReviewScheduledAssessmentParameterDetails = lazy(
  () => import('./user/drdoAdmin/viewAssessments/committeeReviewScheduled/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const DrdoAdminCommitteeReviewScheduled = lazy(() => import('./user/drdoAdmin/viewAssessments/committeeReviewScheduled/CommitteeReviewScheduled'));
export const DrdoAdminInProgressAssessmentDetails = lazy(() => import('./user/drdoAdmin/viewAssessments/inProgress/assessmentDetails/AssessmentDetails'));
export const DrdoAdminInProgressAssessmentParameterDetails = lazy(() => import('./user/drdoAdmin/viewAssessments/inProgress/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'));
export const DrdoAdminInProgress = lazy(() => import('./user/drdoAdmin/viewAssessments/inProgress/InProgress'));
export const DrdoAdminQualityCheckAssessmentDetails = lazy(() => import('./user/drdoAdmin/viewAssessments/qualityCheck/assessmentDetails/AssessmentDetails'));
export const DrdoAdminQualityCheckAssessmentParameterDetails = lazy(
  () => import('./user/drdoAdmin/viewAssessments/qualityCheck/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const DrdoAdminQualityCheck = lazy(() => import('./user/drdoAdmin/viewAssessments/qualityCheck/QualityCheck'));
export const DrdoAdminQualityCheckFeedbackAssessmentDetails = lazy(() => import('./user/drdoAdmin/viewAssessments/qualityCheckFeedback/assessmentDetails/AssessmentDetails'));
export const DrdoAdminQualityCheckFeedbackAssessmentParameterDetails = lazy(
  () => import('./user/drdoAdmin/viewAssessments/qualityCheckFeedback/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const DrdoAdminQualityCheckFeedback = lazy(() => import('./user/drdoAdmin/viewAssessments/qualityCheckFeedback/QualityCheckFeedback'));
export const DrdoAdminReadyForCommitteeReviewAssessmentDetails = lazy(() => import('./user/drdoAdmin/viewAssessments/readyForCommitteeReview/assessmentDetails/AssessmentDetails'));
export const DrdoAdminReadyForCommitteeReviewAssessmentParameterDetails = lazy(
  () => import('./user/drdoAdmin/viewAssessments/readyForCommitteeReview/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const DrdoAdminReadyForCommitteeReview = lazy(() => import('./user/drdoAdmin/viewAssessments/readyForCommitteeReview/ReadyForCommitteeReview'));
export const DrdoAdminScheduledAssessmentDetails = lazy(() => import('./user/drdoAdmin/viewAssessments/schedule/assessmentDetails/AssessmentDetails'));
export const DrdoAdminScheduled = lazy(() => import('./user/drdoAdmin/viewAssessments/schedule/Scheduled'));
export const DRDOLabApplicationDetails = lazy(() => import('./user/drdoLab/certifiedVendors/ApplicationDetails'));
export const DRDOLabCertifiedVendors = lazy(() => import('./user/drdoLab/certifiedVendors/CertifiedVendors'));
export const ApplicantFeedbackList = lazy(() => import('./user/common/applicantFeedback/ApplicantFeedbackList'));
export const ApplicantFeedbackDetails = lazy(() => import('./user/common/applicantFeedback/ApplicantFeedbackDetails'));
export const EnterpriseDetails = lazy(() => import('./user/EnterpriseDetails'));
export const EnterpriseAddNewUnit = lazy(() => import('./user/enterpriseAdmin/AddNewUnit'));
export const EnterpriseAdminDashboard = lazy(() => import('./user/enterpriseAdmin/Dashboard'));
export const EnterpriseDocuments = lazy(() => import('./user/enterpriseAdmin/documents/Documents'));
export const EnterpriseEditUnit = lazy(() => import('./user/enterpriseAdmin/manageUnits/EditUnit'));
export const EnterpriseManageUnits = lazy(() => import('./user/enterpriseAdmin/manageUnits/ManageUnits'));
export const EnterpriseUnitDetails = lazy(() => import('./user/enterpriseAdmin/manageUnits/UnitDetails'));
export const EnterpriseApplicationDetails = lazy(() => import('./user/enterpriseAdmin/myApplication/applicationDetails/ApplicationDetails'));
export const EnterpriseMakePayment = lazy(() => import('./user/enterpriseAdmin/myApplication/applicationDetails/MakePayment'));
export const EnterprisePaymentCallback = lazy(() => import('./user/enterpriseAdmin/myApplication/applicationDetails/PaymentCallback'));
export const EnterprisePaymentSuccessful = lazy(() => import('./user/enterpriseAdmin/myApplication/applicationDetails/PaymentSuccessful'));
export const EnterpriseManufacturingSteps = lazy(() => import('./user/enterpriseAdmin/myApplication/createApplication/manufacturingSteps/ManufacturingSteps'));
export const EnterpriseServicesSteps = lazy(() => import('./user/enterpriseAdmin/myApplication/createApplication/servicesSteps/ServicesSteps'));
export const EnterpriseManufacturingDraftSteps = lazy(() => import('./user/enterpriseAdmin/myApplication/draftApplication/manufacturingDraftSteps/ManufacturingDraftSteps'));
export const EnterpriseServicesDraftSteps = lazy(() => import('./user/enterpriseAdmin/myApplication/draftApplication/servicesDraftSteps/ServicesDraftSteps'));
export const EnterpriseMyApplication = lazy(() => import('./user/enterpriseAdmin/myApplication/MyApplication'));
export const EnterpriseActiveApplications = lazy(() => import('./user/enterpriseAdmin/myApplication/status/ActiveApplications'));
export const EnterpriseDraftApplications = lazy(() => import('./user/enterpriseAdmin/myApplication/status/DraftApplications'));
export const EnterpriseInProgressApplications = lazy(() => import('./user/enterpriseAdmin/myApplication/status/InProgressApplications'));
export const EnterprisePaymentPendingApplications = lazy(() => import('./user/enterpriseAdmin/myApplication/status/PaymentPendingApplications'));
export const EnterprisePendingApplications = lazy(() => import('./user/enterpriseAdmin/myApplication/status/PendingApplications'));
export const EnterpriseAdminOrganisationProfile = lazy(() => import('./user/enterpriseAdmin/organisationProfile/OrganisationProfile'));
export const EnterprisePaymentHistory = lazy(() => import('./user/enterpriseAdmin/paymentHistory/PaymentHistory'));
export const EnterpriseApplicationFeedback = lazy(() => import('./user/enterpriseAdmin/ratingFeedback/ApplicationFeedback'));
export const EnterpriseRatingFeedback = lazy(() => import('./user/enterpriseAdmin/ratingFeedback/RatingFeedback'));
export const EnterpriseSupport = lazy(() => import('./user/enterpriseAdmin/support/Support'));
export const UnitUsers = lazy(() => import('./user/enterpriseAdmin/unitUsers/UnitUsers'));
export const OperationsAdminApplicationsDetails = lazy(() => import('./user/operationsAdmin/applications/ApplicationDetails'));
export const OperationsAdminApplications = lazy(() => import('./user/operationsAdmin/applications/Applications'));
export const OperationsAdminAssessors = lazy(() => import('./user/operationsAdmin/assessors/Assessors'));
export const OperationsAdminAssessorDetails = lazy(() => import('./user/operationsAdmin/assessors/AssessorsDetails'));
export const OperationsAdminCertifiedVendorsDetails = lazy(() => import('./user/operationsAdmin/certifiedVendors/ApplicationDetails'));
export const OperationsAdminCertifiedVendors = lazy(() => import('./user/operationsAdmin/certifiedVendors/CertifiedVendors'));
export const OperationsAdminDashboard = lazy(() => import('./user/operationsAdmin/Dashboard'));
export const OperationsAdminAllocationPending = lazy(() => import('./user/operationsAdmin/manageAssessments/allocationPending/AllocationPending'));
export const OperationsAdminAllocationPendingDetails = lazy(() => import('./user/operationsAdmin/manageAssessments/allocationPending/AllocationPendingDetails'));
export const OperationsAdminCertifiedAssessmentDetails = lazy(() => import('./user/operationsAdmin/manageAssessments/certified/assessmentDetails/AssessmentDetails'));
export const OperationsAdminCertifiedAssessmentParameterDetails = lazy(
  () => import('./user/operationsAdmin/manageAssessments/certified/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const OperationsAdminCertified = lazy(() => import('./user/operationsAdmin/manageAssessments/certified/Certified'));
export const OperationsAdminCommitteeReviewFeedbackAssessmentDetails = lazy(() => import('./user/operationsAdmin/manageAssessments/committeeReviewFeedback/assessmentDetails/AssessmentDetails'));
export const OperationsAdminCommitteeReviewFeedbackAssessmentParameterDetails = lazy(
  () => import('./user/operationsAdmin/manageAssessments/committeeReviewFeedback/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const OperationsAdminCommitteeReviewFeedback = lazy(() => import('./user/operationsAdmin/manageAssessments/committeeReviewFeedback/CommitteeReviewFeedback'));
export const OperationsAdminCommitteeReviewScheduledAssessmentDetails = lazy(() => import('./user/operationsAdmin/manageAssessments/committeeReviewScheduled/assessmentDetails/AssessmentDetails'));
export const OperationsAdminCommitteeReviewScheduledAssessmentParameterDetails = lazy(
  () => import('./user/operationsAdmin/manageAssessments/committeeReviewScheduled/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const OperationsAdminCommitteeReviewScheduled = lazy(() => import('./user/operationsAdmin/manageAssessments/committeeReviewScheduled/CommitteeReviewScheduled'));
export const OperationsAdminProgressAssessmentDetails = lazy(() => import('./user/operationsAdmin/manageAssessments/inProgress/assessmentDetails/AssessmentDetails'));
export const OperationsAdminInProgressAssessmentParameterDetails = lazy(
  () => import('./user/operationsAdmin/manageAssessments/inProgress/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const OperationsAdminInProgress = lazy(() => import('./user/operationsAdmin/manageAssessments/inProgress/InProgress'));
export const OperationsAdminQualityCheckAssessmentDetails = lazy(() => import('./user/operationsAdmin/manageAssessments/qualityCheck/assessmentDetails/AssessmentDetails'));
export const OperationsAdminQualityCheckAssessmentParameterDetails = lazy(
  () => import('./user/operationsAdmin/manageAssessments/qualityCheck/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const OperationsAdminQualityCheck = lazy(() => import('./user/operationsAdmin/manageAssessments/qualityCheck/QualityCheck'));
export const OperationsAdminQualityCheckFeedbackAssessmentDetails = lazy(() => import('./user/operationsAdmin/manageAssessments/qualityCheckFeedback/assessmentDetails/AssessmentDetails'));
export const OpereationAdminQualityCheckFeedbackAssessmentParameterDetails = lazy(
  () => import('./user/operationsAdmin/manageAssessments/qualityCheckFeedback/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const OperationsAdminQualityCheckFeedback = lazy(() => import('./user/operationsAdmin/manageAssessments/qualityCheckFeedback/QualityCheckFeedback'));
export const OperationsAdminReadyForCommitteeReviewAssessmentDetails = lazy(() => import('./user/operationsAdmin/manageAssessments/readyForCommitteeReview/assessmentDetails/AssessmentDetails'));
export const OperationsAdminReadyForCommitteeReviewAssessmentParameterDetails = lazy(
  () => import('./user/operationsAdmin/manageAssessments/readyForCommitteeReview/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const OperationsAdminReadyForCommitteeReview = lazy(() => import('./user/operationsAdmin/manageAssessments/readyForCommitteeReview/ReadyForCommitteeReview'));
export const OperationsAdminRejectedAssessmentDetails = lazy(() => import('./user/operationsAdmin/manageAssessments/rejected/assessmentDetails/AssessmentDetails'));
export const OperationsAdminRejectedAssessments = lazy(() => import('./user/operationsAdmin/manageAssessments/rejected/RejectedAssessments'));
export const OperationsAdminScheduleAssessmentDetails = lazy(() => import('./user/operationsAdmin/manageAssessments/schedule/assessmentDetails/AssessmentDetails'));
export const OperationsAdminSchedule = lazy(() => import('./user/operationsAdmin/manageAssessments/schedule/Scheduled'));
export const OperationsAdminPaymentHistory = lazy(() => import('./user/operationsAdmin/paymentHistory/PaymentHistory'));
export const OperationsAdminMeetings = lazy(() => import('./user/operationsAdmin/ratingCommittee/Meetings/Meetings'));
export const OperationsAdminMeetingsDetails = lazy(() => import('./user/operationsAdmin/ratingCommittee/Meetings/MeetingsDetails'));
export const OperationsAdminReviewAssessmentParameter = lazy(() => import('./user/operationsAdmin/ratingCommittee/Meetings/ReviewAssessmentParameter'));
export const OperationsAdminViewAssessmentParameter = lazy(() => import('./user/operationsAdmin/ratingCommittee/Meetings/ViewAssessmentParameter'));
export const OperationsAdminMembers = lazy(() => import('./user/operationsAdmin/ratingCommittee/Members'));
export const OperationsAdminActiveApplications = lazy(() => import('./user/operationsAdmin/status/ActiveApplications'));
export const OperationsAdminApplicationStatus = lazy(() => import('./user/operationsAdmin/status/ApplicationStatus'));
export const OperationsAdminDraftApplications = lazy(() => import('./user/operationsAdmin/status/DraftApplications'));
export const OperationsAdminInProgressApplications = lazy(() => import('./user/operationsAdmin/status/InProgressApplications'));
export const OperationsAdminPaymentPendingApplications = lazy(() => import('./user/operationsAdmin/status/PaymentPendingApplications'));
export const OperationsAdminPendingApplications = lazy(() => import('./user/operationsAdmin/status/PendingApplications'));
export const OperationsManagerApplicationDetails = lazy(() => import('./user/operationsManager/applications/ApplicationDetails'));
export const OperationsManagerApplications = lazy(() => import('./user/operationsManager/applications/Applications'));
export const OperationsManagerAssessors = lazy(() => import('./user/operationsManager/assessors/Assessors'));
export const OperationsManagerAssessorsDetails = lazy(() => import('./user/operationsManager/assessors/AssessorsDetails'));
export const OperationsManagerCertifiedVenderApplicationDetails = lazy(() => import('./user/operationsManager/certifiedVendors/ApplicationDetails'));
export const OperationsManagerCertifiedVendors = lazy(() => import('./user/operationsManager/certifiedVendors/CertifiedVendors'));
export const OperationsManagerDashboard = lazy(() => import('./user/operationsManager/Dashboard'));
export const OperationsManagerAllocationPending = lazy(() => import('./user/operationsManager/manageAssessments/allocationPending/AllocationPending'));
export const OperationsManagerAllocationPendingDetails = lazy(() => import('./user/operationsManager/manageAssessments/allocationPending/AllocationPendingDetails'));
export const OperationsManagerCertifiedAssessmentDetails = lazy(() => import('./user/operationsManager/manageAssessments/certified/assessmentDetails/AssessmentDetails'));
export const OperationsManagerCertifiedAssessmentParameterDetails = lazy(
  () => import('./user/operationsManager/manageAssessments/certified/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const OperationsManagerCertified = lazy(() => import('./user/operationsManager/manageAssessments/certified/Certified'));
export const OperationsManagerCommitteeReviewFeedbackAssessmentDetails = lazy(() => import('./user/operationsManager/manageAssessments/committeeReviewFeedback/assessmentDetails/AssessmentDetails'));
export const OperationsManagerCommitteeReviewFeedbackAssessmentParameterDetails = lazy(
  () => import('./user/operationsManager/manageAssessments/committeeReviewFeedback/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const OperationsManagerCommitteeReviewFeedback = lazy(() => import('./user/operationsManager/manageAssessments/committeeReviewFeedback/CommitteeReviewFeedback'));
export const OperationsManagerCommitteeReviewScheduleAssessmentDetails = lazy(() => import('./user/operationsManager/manageAssessments/committeeReviewScheduled/assessmentDetails/AssessmentDetails'));
export const OperationsManagerCommitteeReviewScheduleAssessmentParameterDetails = lazy(
  () => import('./user/operationsManager/manageAssessments/committeeReviewScheduled/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const OperationsManagerCommitteeReviewSchedule = lazy(() => import('./user/operationsManager/manageAssessments/committeeReviewScheduled/CommitteeReviewScheduled'));
export const OperationsManagerProgressAssessmentDetails = lazy(() => import('./user/operationsManager/manageAssessments/inProgress/assessmentDetails/AssessmentDetails'));
export const OperationsManagerInProgressAssessmentParameterDetails = lazy(
  () => import('./user/operationsManager/manageAssessments/inProgress/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const OperationsManagerInProgress = lazy(() => import('./user/operationsManager/manageAssessments/inProgress/InProgress'));
export const OperationsManagerQualityCheckAssessmentDetails = lazy(() => import('./user/operationsManager/manageAssessments/qualityCheck/assessmentDetails/AssessmentDetails'));
export const OperationsManagerQualityCheckAssessmentParameterDetails = lazy(
  () => import('./user/operationsManager/manageAssessments/qualityCheck/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const OperationsManagerQualityCheck = lazy(() => import('./user/operationsManager/manageAssessments/qualityCheck/QualityCheck'));
export const OperationsManagerQualityCheckFeedbackAssessmentDetails = lazy(() => import('./user/operationsManager/manageAssessments/qualityCheckFeedback/assessmentDetails/AssessmentDetails'));
export const OperationsManagerQualityCheckFeedbackAssessmentParameterDetails = lazy(
  () => import('./user/operationsManager/manageAssessments/qualityCheckFeedback/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const OperationsManagerQualityCheckFeedback = lazy(() => import('./user/operationsManager/manageAssessments/qualityCheckFeedback/QualityCheckFeedback'));
export const OperationsManagerReadyForCommitteeReviewAssessmentDetails = lazy(() => import('./user/operationsManager/manageAssessments/readyForCommitteeReview/assessmentDetails/AssessmentDetails'));
export const OperationsManagerReadyForCommitteeReviewAssessmentParameterDetails = lazy(
  () => import('./user/operationsManager/manageAssessments/readyForCommitteeReview/assessmentDetails/assessment/assessmentSteps/AssessmentParameterDetails'),
);
export const OperationsManagerReadyForCommitteeReview = lazy(() => import('./user/operationsManager/manageAssessments/readyForCommitteeReview/ReadyForCommitteeReview'));
export const OperationsManagerScheduleAssessmentDetails = lazy(() => import('./user/operationsManager/manageAssessments/schedule/assessmentDetails/AssessmentDetails'));
export const OperationsManagerSchedule = lazy(() => import('./user/operationsManager/manageAssessments/schedule/Scheduled'));
export const OperationPaymentHistory = lazy(() => import('./user/operationsManager/paymentHistory/PaymentHistory'));
export const OperationsManagerActiveApplications = lazy(() => import('./user/operationsManager/status/ActiveApplications'));
export const OperationsManagerApplicationStatus = lazy(() => import('./user/operationsManager/status/ApplicationStatus'));
export const OperationsManagerDraftApplications = lazy(() => import('./user/operationsManager/status/DraftApplications'));
export const OperationsManagerInProgressApplications = lazy(() => import('./user/operationsManager/status/InProgressApplications'));
export const OperationsManagerPaymentPendingApplications = lazy(() => import('./user/operationsManager/status/PaymentPendingApplications'));
export const OperationsManagerPendingApplications = lazy(() => import('./user/operationsManager/status/PendingApplications'));
export const SystemAdminApplicationDetails = lazy(() => import('./user/systemAdmin/applications/ApplicationDetails'));
export const SystemAdminApplications = lazy(() => import('./user/systemAdmin/applications/Applications'));
export const SystemAdminAuditLog = lazy(() => import('./user/systemAdmin/auditLog/AuditLog'));
export const SystemAdmincertifiedVendersDetails = lazy(() => import('./user/systemAdmin/certifiedVendors/ApplicationDetails'));
export const SystemAdminCertifiedVendor = lazy(() => import('./user/systemAdmin/certifiedVendors/CertifiedVendors'));
export const SystemAdminDashboard = lazy(() => import('./user/systemAdmin/Dashboard'));
export const SystemAdminEnterpriseDetails = lazy(() => import('./user/systemAdmin/enterprises/EnterpriseDetails'));
export const SystemAdminEnterprises = lazy(() => import('./user/systemAdmin/enterprises/Enterprises'));
export const SystemAdminIntegrationFailures = lazy(() => import('./user/systemAdmin/integrationFailure/IntegrationFailures'));
export const SystemAdminFeedbackConfigurations = lazy(() => import('./user/systemAdmin/feedbackConfiguration/FeedbackConfigurations'));
export const CommonAssessorDomain = lazy(() => import('./user/systemAdmin/masterCommon/AssessorDomain'));
export const CommonThirdPartyCertificate = lazy(() => import('./user/systemAdmin/masterCommon/ThirdPartyCertificate'));
export const ManufacturingBoughtOutParts = lazy(() => import('./user/systemAdmin/masterManufacturing/BoughtOutParts'));
export const ManufacturingKeyProcesses = lazy(() => import('./user/systemAdmin/masterManufacturing/KeyProcesses'));
export const ManufacturingRawMaterials = lazy(() => import('./user/systemAdmin/masterManufacturing/RawMaterials'));
export const ManufacturingVendorCategories = lazy(() => import('./user/systemAdmin/masterManufacturing/VendorCategories'));
export const ManufacturingVendorStores = lazy(() => import('./user/systemAdmin/masterManufacturing/VendorStores'));
export const ServiceKeyProcesses = lazy(() => import('./user/systemAdmin/masterServices/KeyProcesses'));
export const ServiceKeyServicesResources = lazy(() => import('./user/systemAdmin/masterServices/KeyServicesResources'));
export const ServiceOutsourcedComponents = lazy(() => import('./user/systemAdmin/masterServices/OutsourcedComponents'));
export const ServiceVendorCategories = lazy(() => import('./user/systemAdmin/masterServices/VendorCategories'));
export const ServiceVendorLabs = lazy(() => import('./user/systemAdmin/masterServices/VendorLabs'));
export const SystemAdminPaymentHistory = lazy(() => import('./user/systemAdmin/paymentHistory/PaymentHistory'));
export const ManufacturingAssessmentDisciplines = lazy(() => import('./user/systemAdmin/settingsManufacturing/assessmentDiscipline/AssessmentDisciplines'));
export const ManufacturingAssessmentParameterDetails = lazy(() => import('./user/systemAdmin/settingsManufacturing/assessmentParameter/AssessmentParameterDetail'));
export const ManufacturingAssessmentParameters = lazy(() => import('./user/systemAdmin/settingsManufacturing/assessmentParameter/AssessmentParameters'));
export const ManufacturingFeeConfiguration = lazy(() => import('./user/systemAdmin/settingsManufacturing/FeeConfiguration'));
export const ServicesAssessmentDisciplines = lazy(() => import('./user/systemAdmin/settingsServices/assessmentDiscipline/AssessmentDisciplines'));
export const ServiceAssessmentParameterDetails = lazy(() => import('./user/systemAdmin/settingsServices/assessmentParameter/AssessmentParameterDetail'));
export const ServicesAssessmentParameters = lazy(() => import('./user/systemAdmin/settingsServices/assessmentParameter/AssessmentParameters'));
export const ServicesFeeConfiguration = lazy(() => import('./user/systemAdmin/settingsServices/FeeConfiguration'));
export const SystemAdminActiveApplications = lazy(() => import('./user/systemAdmin/status/ActiveApplications'));
export const SystemAdminPaymentPendingApplications = lazy(() => import('./user/systemAdmin/status/PaymentPendingApplications'));
export const SystemAdminSystemSettings = lazy(() => import('./user/systemAdmin/systemSettings/SystemSettings'));
export const SystemAdminEmailTemplates = lazy(() => import('./user/systemAdmin/emailTemplates/EmailTemplates'));
export const SystemAdminEmailTemplateEdit = lazy(() => import('./user/systemAdmin/emailTemplates/EmailTemplateEdit'));
export const SystemAdminContentBlocks = lazy(() => import('./user/systemAdmin/contentBlocks/ContentBlocks'));
export const SystemAdminEmailServerSettings = lazy(() => import('./user/systemAdmin/emailServer/EmailServerSettings'));
export const SystemAdminBrandingLogos = lazy(() => import('./user/systemAdmin/branding/BrandingLogos'));
export const SystemAdminUserGuides = lazy(() => import('./user/systemAdmin/userGuides/UserGuides'));
export const SystemAdminAssessors = lazy(() => import('./user/systemAdmin/userManagement/assessors/Assessors'));
export const SystemAdminAssessorDetails = lazy(() => import('./user/systemAdmin/userManagement/assessors/AssessorsDetails'));
export const SystemAdminDrdoAdmin = lazy(() => import('./user/systemAdmin/userManagement/drdoAdmin/DrdoAdmin'));
export const SystemAdminDrdoLabs = lazy(() => import('./user/systemAdmin/userManagement/drdoLabs/DrdoLabs'));
export const SystemAdminOperationsAdmin = lazy(() => import('./user/systemAdmin/userManagement/operationsAdmin/OperationsAdmin'));
export const SystemAdminOperationsManager = lazy(() => import('./user/systemAdmin/userManagement/operationsManager/OperationsManager'));
export const UnitsDocuments = lazy(() => import('./user/unitAdmin/documents/Documents'));
export const UnitApplicationDetails = lazy(() => import('./user/unitAdmin/myApplication/applicationDetails/ApplicationDetails'));
// export { default as UnitCreateNewApplication } from './user/unitAdmin/myApplication/createApplication/CreateNewApplication';
export const UnitManufacturingSteps = lazy(() => import('./user/unitAdmin/myApplication/createApplication/manufacturingSteps/ManufacturingSteps'));
export const UnitServicesSteps = lazy(() => import('./user/unitAdmin/myApplication/createApplication/servicesSteps/ServicesSteps'));
export const UnitAdminManufacturingDraftSteps = lazy(() => import('./user/unitAdmin/myApplication/draftApplication/manufacturingDraftSteps/ManufacturingDraftSteps'));
export const UnitAdminServicesDraftSteps = lazy(() => import('./user/unitAdmin/myApplication/draftApplication/servicesDraftSteps/ServicesDraftSteps'));
export const UnitMyApplication = lazy(() => import('./user/unitAdmin/myApplication/MyApplication'));
export const ChangePassword = lazy(() => import('./user/unitAdmin/profile/ChangePassword'));
export const EditProfile = lazy(() => import('./user/unitAdmin/profile/EditProfile'));
export const OrganisationProfile = lazy(() => import('./user/unitAdmin/profile/OrganisationProfile'));
export const UnitApplicationFeedback = lazy(() => import('./user/unitAdmin/ratingFeedback/ApplicationFeedback'));
export const UnitRatingFeedback = lazy(() => import('./user/unitAdmin/ratingFeedback/RatingFeedback'));
export const UnitSupport = lazy(() => import('./user/unitAdmin/support/Support'));
