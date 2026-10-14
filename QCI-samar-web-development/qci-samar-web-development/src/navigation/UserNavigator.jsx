import { useSelector } from 'react-redux';
import { Navigate, Route, Routes } from 'react-router-dom';
import Page from '../components/base/Page';
import {
  ApplicantFeedbackDetails,
  ApplicantFeedbackList,
  AssessorCertified,
  AssessorCertifiedAssessmentDetails,
  AssessorCertifiedAssessmentParameterDetails,
  AssessorCommitteeReviewFeedback,
  AssessorCommitteeReviewFeedbackAssessmentDetails,
  AssessorCommitteeReviewFeedbackAssessmentParameterDetails,
  AssessorCommitteeReviewScheduled,
  AssessorCommitteeReviewScheduledAssessmentDetails,
  AssessorCommitteeReviewScheduledAssessmentParameterDetails,
  AssessorInProgress,
  AssessorInProgressAssessmentParameterDetails,
  AssessorProgressAssessmentDetails,
  AssessorQualityCheck,
  AssessorQualityCheckAssessmentDetails,
  AssessorQualityCheckAssessmentParameterDetails,
  AssessorQualityCheckFeedback,
  AssessorQualityCheckFeedbackAssessmentDetails,
  AssessorQualityCheckFeedbackAssessmentParameterDetails,
  AssessorReadyForCommitteeReview,
  AssessorReadyForCommitteeReviewAssessmentDetails,
  AssessorReadyForCommitteeReviewAssessmentParameterDetails,
  AssessorScheduled,
  AssessorScheduledAssessmentDetails,
  ChangePassword,
  CommonAssessorDomain,
  CommonThirdPartyCertificate,
  DRDOAdminDashboard,
  DRDOApplications,
  DRDOApplicationsDetails,
  DRDOCertifiedVendors,
  DRDOCertifiedVendorsDetails,
  DRDOLabApplicationDetails,
  DRDOLabCertifiedVendors,
  DRDOPaymentDetails,
  DRDOPendingApprovals,
  DRDOPendingApprovalsDetails,
  DrdoAdminActiveApplications,
  DrdoAdminAllocationPending,
  DrdoAdminAllocationPendingDetails,
  DrdoAdminCertified,
  DrdoAdminCertifiedAssessmentDetails,
  DrdoAdminCertifiedAssessmentParameterDetails,
  DrdoAdminCommitteeReviewFeedback,
  DrdoAdminCommitteeReviewFeedbackAssessmentDetails,
  DrdoAdminCommitteeReviewFeedbackAssessmentParameterDetails,
  DrdoAdminCommitteeReviewScheduled,
  DrdoAdminCommitteeReviewScheduledAssessmentDetails,
  DrdoAdminCommitteeReviewScheduledAssessmentParameterDetails,
  DrdoAdminInProgress,
  DrdoAdminInProgressApplications,
  DrdoAdminInProgressAssessmentDetails,
  DrdoAdminInProgressAssessmentParameterDetails,
  DrdoAdminPaymentPendingApplications,
  DrdoAdminPendingApplications,
  DrdoAdminQualityCheck,
  DrdoAdminQualityCheckAssessmentDetails,
  DrdoAdminQualityCheckAssessmentParameterDetails,
  DrdoAdminQualityCheckFeedback,
  DrdoAdminQualityCheckFeedbackAssessmentDetails,
  DrdoAdminQualityCheckFeedbackAssessmentParameterDetails,
  DrdoAdminReadyForCommitteeReview,
  DrdoAdminReadyForCommitteeReviewAssessmentDetails,
  DrdoAdminReadyForCommitteeReviewAssessmentParameterDetails,
  DrdoAdminScheduled,
  DrdoAdminScheduledAssessmentDetails,
  EditProfile,
  EnterpriseActiveApplications,
  EnterpriseAddNewUnit,
  EnterpriseAdminDashboard,
  EnterpriseAdminOrganisationProfile,
  EnterpriseApplicationDetails,
  EnterpriseApplicationFeedback,
  EnterpriseDetails,
  EnterpriseDocuments,
  EnterpriseDraftApplications,
  EnterpriseEditUnit,
  EnterpriseInProgressApplications,
  EnterpriseMakePayment,
  EnterpriseManageUnits,
  EnterpriseManufacturingDraftSteps,
  EnterpriseManufacturingSteps,
  EnterpriseMyApplication,
  EnterprisePaymentCallback,
  EnterprisePaymentHistory,
  EnterprisePaymentPendingApplications,
  EnterprisePaymentSuccessful,
  EnterprisePendingApplications,
  EnterpriseRatingFeedback,
  EnterpriseServicesDraftSteps,
  EnterpriseServicesSteps,
  EnterpriseSupport,
  Maintenance,
  ManufacturingAssessmentDisciplines,
  ManufacturingAssessmentParameterDetails,
  ManufacturingAssessmentParameters,
  ManufacturingBoughtOutParts,
  ManufacturingFeeConfiguration,
  ManufacturingKeyProcesses,
  ManufacturingRawMaterials,
  ManufacturingVendorCategories,
  ManufacturingVendorStores,
  OperationPaymentHistory,
  OperationsAdminActiveApplications,
  OperationsAdminAllocationPending,
  OperationsAdminAllocationPendingDetails,
  OperationsAdminApplications,
  OperationsAdminApplicationsDetails,
  OperationsAdminAssessorDetails,
  OperationsAdminAssessors,
  OperationsAdminCertified,
  OperationsAdminCertifiedAssessmentDetails,
  OperationsAdminCertifiedAssessmentParameterDetails,
  OperationsAdminCertifiedVendors,
  OperationsAdminCertifiedVendorsDetails,
  OperationsAdminCommitteeReviewFeedback,
  OperationsAdminCommitteeReviewFeedbackAssessmentDetails,
  OperationsAdminCommitteeReviewFeedbackAssessmentParameterDetails,
  OperationsAdminCommitteeReviewScheduled,
  OperationsAdminCommitteeReviewScheduledAssessmentDetails,
  OperationsAdminCommitteeReviewScheduledAssessmentParameterDetails,
  OperationsAdminDashboard,
  OperationsAdminDraftApplications,
  OperationsAdminInProgress,
  OperationsAdminInProgressApplications,
  OperationsAdminInProgressAssessmentParameterDetails,
  OperationsAdminMeetings,
  OperationsAdminMeetingsDetails,
  OperationsAdminMembers,
  OperationsAdminPaymentHistory,
  OperationsAdminPaymentPendingApplications,
  OperationsAdminPendingApplications,
  OperationsAdminProgressAssessmentDetails,
  OperationsAdminQualityCheck,
  OperationsAdminQualityCheckAssessmentDetails,
  OperationsAdminQualityCheckAssessmentParameterDetails,
  OperationsAdminQualityCheckFeedback,
  OperationsAdminQualityCheckFeedbackAssessmentDetails,
  OperationsAdminReadyForCommitteeReview,
  OperationsAdminReadyForCommitteeReviewAssessmentDetails,
  OperationsAdminReadyForCommitteeReviewAssessmentParameterDetails,
  OperationsAdminRejectedAssessmentDetails,
  OperationsAdminRejectedAssessments,
  OperationsAdminReviewAssessmentParameter,
  OperationsAdminSchedule,
  OperationsAdminScheduleAssessmentDetails,
  OperationsAdminViewAssessmentParameter,
  OperationsManagerActiveApplications,
  OperationsManagerAllocationPending,
  OperationsManagerAllocationPendingDetails,
  OperationsManagerApplicationDetails,
  OperationsManagerApplications,
  OperationsManagerAssessors,
  OperationsManagerAssessorsDetails,
  OperationsManagerCertified,
  OperationsManagerCertifiedAssessmentDetails,
  OperationsManagerCertifiedAssessmentParameterDetails,
  OperationsManagerCertifiedVenderApplicationDetails,
  OperationsManagerCertifiedVendors,
  OperationsManagerCommitteeReviewFeedback,
  OperationsManagerCommitteeReviewFeedbackAssessmentDetails,
  OperationsManagerCommitteeReviewFeedbackAssessmentParameterDetails,
  OperationsManagerCommitteeReviewSchedule,
  OperationsManagerCommitteeReviewScheduleAssessmentDetails,
  OperationsManagerCommitteeReviewScheduleAssessmentParameterDetails,
  OperationsManagerDashboard,
  OperationsManagerDraftApplications,
  OperationsManagerInProgress,
  OperationsManagerInProgressApplications,
  OperationsManagerInProgressAssessmentParameterDetails,
  OperationsManagerPaymentPendingApplications,
  OperationsManagerPendingApplications,
  OperationsManagerProgressAssessmentDetails,
  OperationsManagerQualityCheck,
  OperationsManagerQualityCheckAssessmentDetails,
  OperationsManagerQualityCheckAssessmentParameterDetails,
  OperationsManagerQualityCheckFeedback,
  OperationsManagerQualityCheckFeedbackAssessmentDetails,
  OperationsManagerQualityCheckFeedbackAssessmentParameterDetails,
  OperationsManagerReadyForCommitteeReview,
  OperationsManagerReadyForCommitteeReviewAssessmentDetails,
  OperationsManagerReadyForCommitteeReviewAssessmentParameterDetails,
  OperationsManagerSchedule,
  OperationsManagerScheduleAssessmentDetails,
  OpereationAdminQualityCheckFeedbackAssessmentParameterDetails,
  OrganisationProfile,
  ServiceAssessmentParameterDetails,
  ServiceKeyProcesses,
  ServiceKeyServicesResources,
  ServiceOutsourcedComponents,
  ServicesAssessmentDisciplines,
  ServicesAssessmentParameters,
  ServicesFeeConfiguration,
  ServiceVendorCategories,
  ServiceVendorLabs,
  SetUnavailability,
  SystemAdminActiveApplications,
  SystemAdminApplicationDetails,
  SystemAdminApplications,
  SystemAdminAssessorDetails,
  SystemAdminAssessors,
  SystemAdminAuditLog,
  SystemAdminBrandingLogos,
  SystemAdminCertifiedVendor,
  SystemAdminContentBlocks,
  SystemAdmincertifiedVendersDetails,
  SystemAdminDashboard,
  SystemAdminDrdoAdmin,
  SystemAdminDrdoLabs,
  SystemAdminEmailServerSettings,
  SystemAdminEmailTemplateEdit,
  SystemAdminEmailTemplates,
  SystemAdminEnterpriseDetails,
  SystemAdminEnterprises,
  SystemAdminFeedbackConfigurations,
  SystemAdminIntegrationFailures,
  SystemAdminOperationsAdmin,
  SystemAdminOperationsManager,
  SystemAdminPaymentHistory,
  SystemAdminPaymentPendingApplications,
  SystemAdminSystemSettings,
  SystemAdminUserGuides,
  UnitAdminManufacturingDraftSteps,
  UnitAdminServicesDraftSteps,
  UnitApplicationDetails,
  UnitApplicationFeedback,
  UnitManufacturingSteps,
  UnitMyApplication,
  UnitRatingFeedback,
  UnitServicesSteps,
  UnitSupport,
  UnitsDocuments,
  UnitUsers,
  VerifyCertificate,
} from '../screens';

function getElementByRole(role, options, title) {
  const element = options?.[role] ?? options?.['default'];
  return <Page title={title}>{element}</Page>;
}
export default function UserNavigator() {
  const { user } = useSelector(state => state.Account);
  const role = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles[0].slug : undefined;
  // const role = 'operations_manager';

  // Dynamic title mapping

  return (
    <Routes>
      <Route
        path="/"
        element={
          role === 'assessor' ? (
            <Navigate to="/scheduled" replace />
          ) : role === 'unit_admin' ? (
            <Navigate to="/applications" replace />
          ) : (
            getElementByRole(
              role,
              {
                drdo_admin: <DRDOAdminDashboard />,
                enterprise_admin: <EnterpriseAdminDashboard />,
                operations_manager: <OperationsManagerDashboard />,
                operations_admin: <OperationsAdminDashboard />,
                system_admin: <SystemAdminDashboard />,
                drdo_lab: <DRDOLabCertifiedVendors />,
              },
              'Dashboard',
            )
          )
        }
      />
      {/* My Application */}
      <Route
        path="/applications"
        element={getElementByRole(
          role,
          {
            drdo_admin: <DRDOApplications />,
            unit_admin: <UnitMyApplication />,
            enterprise_admin: <EnterpriseMyApplication />,
            operations_admin: <OperationsAdminApplications />,
            operations_manager: <OperationsManagerApplications />,
            system_admin: <SystemAdminApplications />,
          },
          'Applications',
        )}
      />
      {/* Pending Applications */}
      <Route
        path="/applications/drdo_approval_pending"
        element={getElementByRole(
          role,
          {
            enterprise_admin: <EnterprisePendingApplications />,
            operations_manager: <OperationsManagerPendingApplications />,
            operations_admin: <OperationsAdminPendingApplications />,
            drdo_admin: <DrdoAdminPendingApplications />,
          },
          'Pending Applications',
        )}
      />
      {/* Draft Applications */}
      <Route
        path="/applications/draft"
        element={getElementByRole(
          role,
          {
            enterprise_admin: <EnterpriseDraftApplications />,
            operations_manager: <OperationsManagerDraftApplications />,
            operations_admin: <OperationsAdminDraftApplications />,
          },
          'Draft Applications',
        )}
      />
      {/* Active Applications */}
      <Route
        path="/applications/active"
        element={getElementByRole(
          role,
          {
            enterprise_admin: <EnterpriseActiveApplications />,
            operations_manager: <OperationsManagerActiveApplications />,
            operations_admin: <OperationsAdminActiveApplications />,
            drdo_admin: <DrdoAdminActiveApplications />,
            system_admin: <SystemAdminActiveApplications />,
          },
          'Active Applications',
        )}
      />
      {/* In Progress Applications */}
      <Route
        path="/applications/in-progress"
        element={getElementByRole(
          role,
          {
            enterprise_admin: <EnterpriseInProgressApplications />,
            operations_manager: <OperationsManagerInProgressApplications />,
            operations_admin: <OperationsAdminInProgressApplications />,
            drdo_admin: <DrdoAdminInProgressApplications />,
          },
          'In Progress Applications',
        )}
      />
      {/* Payment Pending Applications */}
      <Route
        path="/applications/payment-pending"
        element={getElementByRole(
          role,
          {
            enterprise_admin: <EnterprisePaymentPendingApplications />,
            operations_manager: <OperationsManagerPaymentPendingApplications />,
            operations_admin: <OperationsAdminPaymentPendingApplications />,
            drdo_admin: <DrdoAdminPaymentPendingApplications />,
            system_admin: <SystemAdminPaymentPendingApplications />,
          },
          'Payment Pending Applications',
        )}
      />

      <Route
        path="/payment-history"
        element={getElementByRole(
          role,
          {
            drdo_admin: <DRDOPaymentDetails />,
            enterprise_admin: <EnterprisePaymentHistory />,
            operations_manager: <OperationPaymentHistory />,

            operations_admin: <OperationsAdminPaymentHistory />,
            system_admin: <SystemAdminPaymentHistory />,
          },
          'Payment History',
        )}
      />
      {/* Documents */}
      <Route
        path="/documents"
        element={getElementByRole(
          role,
          {
            enterprise_admin: <EnterpriseDocuments />,
            unit_admin: <UnitsDocuments />,
          },
          'Documents',
        )}
      />
      {/* Support */}
      <Route
        path="/support"
        element={getElementByRole(
          role,
          {
            enterprise_admin: <EnterpriseSupport />,
            unit_admin: <UnitSupport />,
          },
          'Support',
        )}
      />
      {/* Enterprise Details */}
      <Route
        path="/enterprise-details"
        element={getElementByRole(
          role,
          {
            drdo_admin: <EnterpriseDetails />,
            enterprise_admin: <EnterpriseDetails />,
            unit_admin: <EnterpriseDetails />,
          },
          'Enterprise Details',
        )}
      />
      {/* Manufacturing Steps */}
      <Route
        path="/create-new-application/manufacturing-steps"
        element={getElementByRole(
          role,
          {
            drdo_admin: <UnitManufacturingSteps />,
            enterprise_admin: <EnterpriseManufacturingSteps />,
            unit_admin: <UnitManufacturingSteps />,
          },
          'Manufacturing Steps',
        )}
      />
      <Route
        path="/draft-application/manufacturing-steps/:id"
        element={getElementByRole(
          role,
          {
            drdo_admin: <UnitManufacturingSteps />,
            enterprise_admin: <EnterpriseManufacturingDraftSteps />,
            unit_admin: <UnitAdminManufacturingDraftSteps />,
          },
          'Draft Manufacturing Steps',
        )}
      />
      {/* Services Steps */}
      <Route
        path="/create-new-application/services-steps"
        element={getElementByRole(
          role,
          {
            drdo_admin: <UnitServicesSteps />,
            enterprise_admin: <EnterpriseServicesSteps />,
            unit_admin: <UnitServicesSteps />,
          },
          'Services Steps',
        )}
      />
      {/* Services Draft Steps */}
      <Route
        path="/draft-application/service-steps/:id"
        element={getElementByRole(
          role,
          {
            drdo_admin: <UnitServicesSteps />,
            enterprise_admin: <EnterpriseServicesDraftSteps />,
            unit_admin: <UnitAdminServicesDraftSteps />,
          },
          'Draft Services Steps',
        )}
      />
      <Route
        path="/draft-application/services-steps"
        element={getElementByRole(
          role,
          {
            drdo_admin: <UnitServicesSteps />,
            enterprise_admin: <EnterpriseServicesDraftSteps />,
            unit_admin: <UnitAdminServicesDraftSteps />,
          },
          'Draft Services Steps',
        )}
      />
      {/* Rating Feedback */}
      <Route
        path="/rating-feedback"
        element={getElementByRole(
          role,
          {
            drdo_admin: <UnitRatingFeedback />,
            enterprise_admin: <EnterpriseRatingFeedback />,
            unit_admin: <UnitRatingFeedback />,
          },
          'Rating Feedback',
        )}
      />

      {/* Applicant Feedback (Operations Manager / Operations Admin / System Admin) */}
      <Route
        path="/applicant-feedback"
        element={getElementByRole(
          role,
          {
            operations_manager: <ApplicantFeedbackList />,
            operations_admin: <ApplicantFeedbackList />,
            system_admin: <ApplicantFeedbackList />,
          },
          'Applicant Feedback',
        )}
      />
      <Route
        path="/applicant-feedback/details/:id"
        element={getElementByRole(
          role,
          {
            operations_manager: <ApplicantFeedbackDetails />,
            operations_admin: <ApplicantFeedbackDetails />,
            system_admin: <ApplicantFeedbackDetails />,
          },
          'Applicant Feedback Details',
        )}
      />

      {/* Add New Unit */}
      <Route
        path="/add-new-unit"
        element={getElementByRole(
          role,
          {
            enterprise_admin: <EnterpriseAddNewUnit />,
          },
          'Add New Unit',
        )}
      />
      <Route
        path="/allocation-pending"
        element={getElementByRole(
          role,
          {
            operations_manager: <OperationsManagerAllocationPending />,
            operations_admin: <OperationsAdminAllocationPending />,
            drdo_admin: <DrdoAdminAllocationPending />,
          },
          'Allocation Pending',
        )}
      />
      <Route
        path="/allocation-pending/allocation-pending-details/:id"
        element={getElementByRole(
          role,
          {
            operations_manager: <OperationsManagerAllocationPendingDetails />,
            operations_admin: <OperationsAdminAllocationPendingDetails />,
            drdo_admin: <DrdoAdminAllocationPendingDetails />,
          },
          'Allocation Pending Details',
        )}
      />
      {/* Units */}
      {/* <Route
        path="/units"
        element={getElementByRole(
          role,
          {
            drdo_admin: <UnitUnits />,
            enterprise_admin: <UnitUnits />,
            unit_admin: <UnitUnits />,
          },
          'Units',
        )}
      /> */}
      {/* Unit Details */}
      {/* <Route
        path="/units/unit-details/:id"
        element={getElementByRole(
          role,
          {
            drdo_admin: <UnitsDetails />,
            enterprise_admin: <EnterpriseUnitDetails />,
            unit_admin: <UnitsDetails />,
          },
          'Unit Details',
        )}
      /> */}
      {/* Application Feedback */}
      <Route
        path="/rating-feedback/application-feedback/:id"
        element={getElementByRole(
          role,
          {
            drdo_admin: <UnitApplicationFeedback />,
            enterprise_admin: <EnterpriseApplicationFeedback />,
            unit_admin: <UnitApplicationFeedback />,
          },
          'Application Feedback',
        )}
      />
      {/* Change Password */}
      <Route
        path="/change-password"
        element={getElementByRole(
          role,
          {
            drdo_admin: <ChangePassword />,
            enterprise_admin: <ChangePassword />,
            unit_admin: <ChangePassword />,
            system_admin: <ChangePassword />,
            operations_admin: <ChangePassword />,
            drdo_lab: <ChangePassword />,
            operations_manager: <ChangePassword />,
            assessor: <ChangePassword />,
          },
          'Change Password',
        )}
      />
      {/* Edit Profile */}
      <Route
        path="/edit-profile"
        element={getElementByRole(
          role,
          {
            drdo_admin: <EditProfile />,
            enterprise_admin: <EditProfile />,
            unit_admin: <EditProfile />,
            operations_admin: <EditProfile />,
            operations_manager: <EditProfile />,
            system_admin: <EditProfile />,
            assessor: <EditProfile />,
            drdo_lab: <EditProfile />,
          },
          'Edit Profile',
        )}
      />
      {/* Set Unavailability (assessor only) */}
      <Route
        path="/set-unavailability"
        element={getElementByRole(
          role,
          {
            assessor: <SetUnavailability />,
          },
          'Set Unavailability',
        )}
      />
      {/* Organisation Profile */}
      <Route
        path="/organisation-profile"
        element={getElementByRole(
          role,
          {
            drdo_admin: <OrganisationProfile />,
            enterprise_admin: <EnterpriseAdminOrganisationProfile />,
            unit_admin: <OrganisationProfile />,
          },
          'Enterprise Profile',
        )}
      />
      {/* Application Details */}
      <Route
        path="/my-application/application-details/:id"
        element={getElementByRole(
          role,
          {
            drdo_admin: <DRDOApplicationsDetails />,
            enterprise_admin: <EnterpriseApplicationDetails />,
            unit_admin: <UnitApplicationDetails />,
            system_admin: <SystemAdminApplicationDetails />,
            operations_admin: <OperationsAdminApplicationsDetails />,
            operations_manager: <OperationsManagerApplicationDetails />,
          },
          'Application Details',
        )}
      />
      {/* Pending Approval */}
      <Route
        path="/pending-approval"
        element={getElementByRole(
          role,
          {
            drdo_admin: <DRDOPendingApprovals />,
            enterprise_admin: <DRDOPendingApprovals />,
            unit_admin: <DRDOPendingApprovals />,
          },
          'Pending Approval',
        )}
      />
      {/* Certified Vendors */}
      <Route
        path="/certified-vendors"
        element={getElementByRole(
          role,
          {
            drdo_admin: <DRDOCertifiedVendors />,
            drdo_lab: <DRDOLabCertifiedVendors />,
            enterprise_admin: <DRDOCertifiedVendors />,
            operations_manager: <OperationsManagerCertifiedVendors />,
            system_admin: <SystemAdminCertifiedVendor />,
            operations_admin: <OperationsAdminCertifiedVendors />,
          },
          'Certified',
        )}
      />

      {/* Manage Units */}
      <Route
        path="/manage-units"
        element={getElementByRole(
          role,
          {
            enterprise_admin: <EnterpriseManageUnits />,
          },
          'Manage Units',
        )}
      />
      {/* Edit Unit */}
      <Route
        path="/units/edit-unit/:id"
        element={getElementByRole(
          role,
          {
            enterprise_admin: <EnterpriseEditUnit />,
          },
          'Edit Unit',
        )}
      />
      {/* Pending Approval Application Details */}
      <Route
        path="/pending-approval/application-details/:id"
        element={getElementByRole(
          role,
          {
            drdo_admin: <DRDOPendingApprovalsDetails />,
            enterprise_admin: <DRDOPendingApprovalsDetails />,
          },
          'Pending Approval Details',
        )}
      />
      {/* Assessors (Operation Admin only) */}
      <Route
        path="/verify-certificate"
        element={getElementByRole(
          role,
          {
            operations_admin: <VerifyCertificate />,
          },
          'Assessors',
        )}
      />
      <Route
        path="/assessors"
        element={getElementByRole(
          role,
          {
            operations_manager: <OperationsManagerAssessors />,
            operations_admin: <OperationsAdminAssessors />,
            system_admin: <SystemAdminAssessors />,
          },
          'Assessors',
        )}
      />
      <Route
        path="/assessors/assessor-details/:id"
        element={getElementByRole(
          role,
          {
            system_admin: <SystemAdminAssessorDetails />,
            operations_manager: <OperationsManagerAssessorsDetails />,
            operations_admin: <OperationsAdminAssessorDetails />,
          },
          'Assessor Details',
        )}
      />
      {/* Certified Vendors Application Details */}
      <Route
        path="/certified-vendors/application-details/:id"
        element={getElementByRole(
          role,
          {
            drdo_admin: <DRDOCertifiedVendorsDetails />,
            enterprise_admin: <DRDOCertifiedVendorsDetails />,
            system_admin: <SystemAdmincertifiedVendersDetails />,
            drdo_lab: <DRDOLabApplicationDetails />,
            operations_admin: <OperationsAdminCertifiedVendorsDetails />,
            operations_manager: <OperationsManagerCertifiedVenderApplicationDetails />,
          },
          'Certified Vendors Details',
        )}
      />
      {/* Make Payment — shared screens; components pick the correct Redux slice by role */}
      <Route
        path="/make-payment"
        element={getElementByRole(
          role,
          {
            enterprise_admin: <EnterpriseMakePayment />,
            unit_admin: <EnterpriseMakePayment />,
          },
          'Make Payment',
        )}
      />
      {/* Payment Callback (ICICI EazyPay return URL) */}
      <Route
        path="/payment-callback"
        element={getElementByRole(
          role,
          {
            enterprise_admin: <EnterprisePaymentCallback />,
            unit_admin: <EnterprisePaymentCallback />,
          },
          'Payment Processing',
        )}
      />
      {/* Payment Successful */}
      <Route
        path="/payment-successful"
        element={getElementByRole(
          role,
          {
            enterprise_admin: <EnterprisePaymentSuccessful />,
            unit_admin: <EnterprisePaymentSuccessful />,
          },
          'Payment Successful',
        )}
      />
      {/* Enterprise Accounts (Operation Admin only) */}

      <Route
        path="/scheduled"
        element={getElementByRole(
          role,
          {
            assessor: <AssessorScheduled />,
            operations_admin: <OperationsAdminSchedule />,
            operations_manager: <OperationsManagerSchedule />,
            drdo_admin: <DrdoAdminScheduled />,
          },
          'Scheduled Assessments',
        )}
      />
      <Route
        path="/scheduled/assessment-details/:id"
        element={getElementByRole(
          role,
          {
            assessor: <AssessorScheduledAssessmentDetails />,
            operations_admin: <OperationsAdminScheduleAssessmentDetails />,
            operations_manager: <OperationsManagerScheduleAssessmentDetails />,
            drdo_admin: <DrdoAdminScheduledAssessmentDetails />,
          },
          'Scheduled Assessment Details',
        )}
      />
      <Route
        path="/rating-committee/meetings"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminMeetings />,
          },
          'Meetings',
        )}
      />
      <Route
        path="/rating-committee/meetings/meeting-details/:meetingId"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminMeetingsDetails />,
          },
          'Meeting Details',
        )}
      />
      <Route
        path="/rating-committee/meetings/review-assessment-parameter/:assessmentId?"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminReviewAssessmentParameter />,
          },
          'Review Assessment',
        )}
      />
      <Route
        path="/rating-committee/meetings/view-assessment-parameter/:assessmentId?"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminViewAssessmentParameter />,
          },
          'View Assessment',
        )}
      />
      <Route
        path="/in-progress-assessment-details/:id"
        element={getElementByRole(
          role,
          {
            assessor: <AssessorProgressAssessmentDetails />,
            operations_admin: <OperationsAdminProgressAssessmentDetails />,
            operations_manager: <OperationsManagerProgressAssessmentDetails />,
            drdo_admin: <DrdoAdminInProgressAssessmentDetails />,
          },
          'Progress Assessment Details',
        )}
      />

      <Route
        path="/assessment-parameter-details/:id"
        element={getElementByRole(
          role,
          {
            assessor: <AssessorInProgressAssessmentParameterDetails />,
            operations_admin: <OperationsAdminInProgressAssessmentParameterDetails />,
            operations_manager: <OperationsManagerInProgressAssessmentParameterDetails />,
            drdo_admin: <DrdoAdminInProgressAssessmentParameterDetails />,
          },
          'Assessment Parameter Details',
        )}
      />
      <Route
        path="/rating-committee/members"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminMembers />,
          },
          'Members',
        )}
      />
      <Route
        path="/in-progress"
        element={getElementByRole(
          role,
          {
            assessor: <AssessorInProgress />,
            operations_admin: <OperationsAdminInProgress />,
            operations_manager: <OperationsManagerInProgress />,
            drdo_admin: <DrdoAdminInProgress />,
          },
          'In Progress',
        )}
      />
      <Route
        path="/quality-check-feedback"
        element={getElementByRole(
          role,
          {
            assessor: <AssessorQualityCheckFeedback />,
            operations_admin: <OperationsAdminQualityCheckFeedback />,
            operations_manager: <OperationsManagerQualityCheckFeedback />,
            drdo_admin: <DrdoAdminQualityCheckFeedback />,
          },
          'Quality Check Feedback',
        )}
      />
      <Route
        path="/quality-check-feedback-assessment-details/:id"
        element={getElementByRole(
          role,
          {
            assessor: <AssessorQualityCheckFeedbackAssessmentDetails />,
            operations_admin: <OperationsAdminQualityCheckFeedbackAssessmentDetails />,
            operations_manager: <OperationsManagerQualityCheckFeedbackAssessmentDetails />,
            drdo_admin: <DrdoAdminQualityCheckFeedbackAssessmentDetails />,
          },
          'Quality Check Feedback Assessment Details',
        )}
      />
      <Route
        path="/quality-check-feedback-assessment-parameter-details/:id"
        element={getElementByRole(
          role,
          {
            assessor: <AssessorQualityCheckFeedbackAssessmentParameterDetails />,
            operations_admin: <OpereationAdminQualityCheckFeedbackAssessmentParameterDetails />,
            operations_manager: <OperationsManagerQualityCheckFeedbackAssessmentParameterDetails />,
            drdo_admin: <DrdoAdminQualityCheckFeedbackAssessmentParameterDetails />,
          },
          'Quality Check',
        )}
      />
      <Route
        path="/committee-review-feedback"
        element={getElementByRole(
          role,
          {
            operations_manager: <OperationsManagerCommitteeReviewFeedback />,
            drdo_admin: <DrdoAdminCommitteeReviewFeedback />,
            assessor: <AssessorCommitteeReviewFeedback />,
            operations_admin: <OperationsAdminCommitteeReviewFeedback />,
          },
          'Committee Review Feedback',
        )}
      />
      <Route
        path="/committee-review-feedback/assessment-details/:id"
        element={getElementByRole(
          role,
          {
            operations_manager: <OperationsManagerCommitteeReviewFeedbackAssessmentDetails />,
            drdo_admin: <DrdoAdminCommitteeReviewFeedbackAssessmentDetails />,
            assessor: <AssessorCommitteeReviewFeedbackAssessmentDetails />,
            operations_admin: <OperationsAdminCommitteeReviewFeedbackAssessmentDetails />,
          },
          'Committee Review Feedback Assessment Details',
        )}
      />
      <Route
        path="/committee-review-feedback-assessment-parameter-details"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminCommitteeReviewFeedbackAssessmentParameterDetails />,
            // operations_manager: <operationsManagerCommitteeReviewFeedbackAssessmentParameterDetails />,
            operations_manager: <OperationsManagerCommitteeReviewFeedbackAssessmentParameterDetails />,
            drdo_admin: <DrdoAdminCommitteeReviewFeedbackAssessmentParameterDetails />,
            assessor: <AssessorCommitteeReviewFeedbackAssessmentParameterDetails />,
          },
          'Committee Review Feedback Assessment Parameter Details',
        )}
      />
      <Route
        path="/rejected-assessments"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminRejectedAssessments />,
          },
          'Rejected Assessments',
        )}
      />
      <Route
        path="/rejected-assessments/assessment-details/:id"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminRejectedAssessmentDetails />,
          },
          'Rejected Assessment Details',
        )}
      />

      <Route
        path="/quality-check"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminQualityCheck />,
            operations_manager: <OperationsManagerQualityCheck />,
            drdo_admin: <DrdoAdminQualityCheck />,
            assessor: <AssessorQualityCheck />,
          },
          'Quality Check',
        )}
      />
      <Route
        path="/quality-check-assessment-details/:id"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminQualityCheckAssessmentDetails />,
            operations_manager: <OperationsManagerQualityCheckAssessmentDetails />,
            drdo_admin: <DrdoAdminQualityCheckAssessmentDetails />,
            assessor: <AssessorQualityCheckAssessmentDetails />,
          },
          'Quality Check Assessment Details',
        )}
      />
      <Route
        path="/quality-check-assessment-parameter-details"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminQualityCheckAssessmentParameterDetails />,
            operations_manager: <OperationsManagerQualityCheckAssessmentParameterDetails />,
            drdo_admin: <DrdoAdminQualityCheckAssessmentParameterDetails />,
            assessor: <AssessorQualityCheckAssessmentParameterDetails />,
          },
          'Quality Check Assessment Parameter Details',
        )}
      />
      <Route
        path="/committee-review-scheduled-assessment-parameter-details"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminCommitteeReviewScheduledAssessmentParameterDetails />,
            operations_manager: <OperationsManagerCommitteeReviewScheduleAssessmentParameterDetails />,
            drdo_admin: <DrdoAdminCommitteeReviewScheduledAssessmentParameterDetails />,
            assessor: <AssessorCommitteeReviewScheduledAssessmentParameterDetails />,
          },
          'Committee Review Scheduled Assessment Parameter Details',
        )}
      />
      <Route
        path="/committee-review-scheduled"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminCommitteeReviewScheduled />,
            operations_manager: <OperationsManagerCommitteeReviewSchedule />,
            drdo_admin: <DrdoAdminCommitteeReviewScheduled />,
            assessor: <AssessorCommitteeReviewScheduled />,
          },
          'committee-review-scheduled',
        )}
      />
      <Route
        path="/committee-review-scheduled-assessment-details/:id"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminCommitteeReviewScheduledAssessmentDetails />,
            operations_manager: <OperationsManagerCommitteeReviewScheduleAssessmentDetails />,
            drdo_admin: <DrdoAdminCommitteeReviewScheduledAssessmentDetails />,
            assessor: <AssessorCommitteeReviewScheduledAssessmentDetails />,
          },
          'Committee Review Scheduled Assessment Details',
        )}
      />
      <Route
        path="/certified"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminCertified />,
            operations_manager: <OperationsManagerCertified />,
            drdo_admin: <DrdoAdminCertified />,
            assessor: <AssessorCertified />,
          },
          'Certified',
        )}
      />
      <Route
        path="/certified-assessment-details/:id"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminCertifiedAssessmentDetails />,
            operations_manager: <OperationsManagerCertifiedAssessmentDetails />,
            drdo_admin: <DrdoAdminCertifiedAssessmentDetails />,
            assessor: <AssessorCertifiedAssessmentDetails />,
          },
          'Certified Assessment Details',
        )}
      />
      <Route
        path="/certified-assessment-parameter-details"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminCertifiedAssessmentParameterDetails />,
            operations_manager: <OperationsManagerCertifiedAssessmentParameterDetails />,
            drdo_admin: <DrdoAdminCertifiedAssessmentParameterDetails />,
            assessor: <AssessorCertifiedAssessmentParameterDetails />,
          },
          'Certified Assessment Parameter Details',
        )}
      />
      <Route
        path="/ready-for-committee-review"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminReadyForCommitteeReview />,
            operations_manager: <OperationsManagerReadyForCommitteeReview />,
            drdo_admin: <DrdoAdminReadyForCommitteeReview />,
            assessor: <AssessorReadyForCommitteeReview />,
          },
          'Ready For Committee Review',
        )}
      />
      <Route
        path="/ready-for-committee-review-assessment-details/:id"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminReadyForCommitteeReviewAssessmentDetails />,
            operations_manager: <OperationsManagerReadyForCommitteeReviewAssessmentDetails />,
            drdo_admin: <DrdoAdminReadyForCommitteeReviewAssessmentDetails />,
            assessor: <AssessorReadyForCommitteeReviewAssessmentDetails />,
          },
          'Ready For Committee Review Assessment Details',
        )}
      />
      <Route
        path="/ready-for-committee-review-assessment-parameter-details"
        element={getElementByRole(
          role,
          {
            operations_admin: <OperationsAdminReadyForCommitteeReviewAssessmentParameterDetails />,
            operations_manager: <OperationsManagerReadyForCommitteeReviewAssessmentParameterDetails />,
            drdo_admin: <DrdoAdminReadyForCommitteeReviewAssessmentParameterDetails />,
            assessor: <AssessorReadyForCommitteeReviewAssessmentParameterDetails />,
          },
          'Ready For Committee Review Assessment Parameter Details',
        )}
      />
      <Route
        path="/drdo-admins"
        element={getElementByRole(
          role,
          {
            system_admin: <SystemAdminDrdoAdmin />,
          },
          'DRDO Admins',
        )}
      />
      <Route
        path="/operations-admins"
        element={getElementByRole(
          role,
          {
            system_admin: <SystemAdminOperationsAdmin />,
          },
          'Operations Admins',
        )}
      />
      <Route
        path="/operations-managers"
        element={getElementByRole(
          role,
          {
            system_admin: <SystemAdminOperationsManager />,
          },
          'Operations Managers',
        )}
      />
      <Route
        path="/feedback-configuration"
        element={getElementByRole(
          role,
          {
            system_admin: <SystemAdminFeedbackConfigurations />,
          },
          'Feedback Configuration',
        )}
      />

      <Route
        path="/drdo-labs"
        element={getElementByRole(
          role,
          {
            system_admin: <SystemAdminDrdoLabs />,
          },
          'DRDO Labs',
        )}
      />
      <Route
        path="/vendor-categories"
        element={getElementByRole(
          role,
          {
            system_admin: <ManufacturingVendorCategories />,
          },
          'Categories',
        )}
      />
      <Route
        path="/manufacturing-vendor-stores"
        element={getElementByRole(
          role,
          {
            system_admin: <ManufacturingVendorStores />,
          },
          'Manufacturing Stores',
        )}
      />
      <Route
        path="/manufacturing-key-raw-materials"
        element={getElementByRole(
          role,
          {
            system_admin: <ManufacturingRawMaterials />,
          },
          'Manufacturing Key Raw Materials',
        )}
      />
      <Route
        path="/manufacturing-bought-out-parts"
        element={getElementByRole(
          role,
          {
            system_admin: <ManufacturingBoughtOutParts />,
          },
          'Manufacturing Bought-Out Parts',
        )}
      />
      <Route
        path="/manufacturing-key-processes"
        element={getElementByRole(
          role,
          {
            system_admin: <ManufacturingKeyProcesses />,
          },
          'Manufacturing Key Processes',
        )}
      />

      <Route
        path="/service-vendor-labs"
        element={getElementByRole(
          role,
          {
            system_admin: <ServiceVendorLabs />,
          },
          'Service Labs',
        )}
      />
      <Route
        path="/service-key-processes"
        element={getElementByRole(
          role,
          {
            system_admin: <ServiceKeyProcesses />,
          },
          'Key Services',
        )}
      />
      <Route
        path="/key-service-resources"
        element={getElementByRole(
          role,
          {
            system_admin: <ServiceKeyServicesResources />,
          },
          'Key Service Resources',
        )}
      />
      <Route
        path="/service-vendor-categories"
        element={getElementByRole(
          role,
          {
            system_admin: <ServiceVendorCategories />,
          },
          'Service Categories',
        )}
      />
      <Route
        path="/outsourced-service-components"
        element={getElementByRole(
          role,
          {
            system_admin: <ServiceOutsourcedComponents />,
          },
          'Outsourced Service Components',
        )}
      />
      <Route
        path="/assessor-domains"
        element={getElementByRole(
          role,
          {
            system_admin: <CommonAssessorDomain />,
          },
          'Assessor Domains',
        )}
      />
      <Route
        path="/third-party-certificates"
        element={getElementByRole(
          role,
          {
            system_admin: <CommonThirdPartyCertificate />,
          },
          'Third Party Certificates',
        )}
      />
      <Route
        path="/service-fee-configuration"
        element={getElementByRole(
          role,
          {
            system_admin: <ServicesFeeConfiguration />,
          },
          'Service Fee Configuration',
        )}
      />
      <Route
        path="/manufacturing-fee-configuration"
        element={getElementByRole(
          role,
          {
            system_admin: <ManufacturingFeeConfiguration />,
          },
          'Manufacturing Fee Configuration',
        )}
      />
      <Route
        path="/service-assessment-parameters"
        element={getElementByRole(
          role,
          {
            system_admin: <ServicesAssessmentParameters />,
          },
          'Service Assessment Parameters',
        )}
      />
      <Route
        path="/manufacturing-assessment-parameters"
        element={getElementByRole(
          role,
          {
            system_admin: <ManufacturingAssessmentParameters />,
          },
          'Manufacturing Assessment Parameters',
        )}
      />
      <Route
        path="/manufacturing-assessment-parameter-details/:id"
        element={getElementByRole(
          role,
          {
            system_admin: <ManufacturingAssessmentParameterDetails />,
          },
          'Manufacturing Assessment Parameter Details',
        )}
      />
      <Route
        path="/service-assessment-parameter-details/:id"
        element={getElementByRole(
          role,
          {
            system_admin: <ServiceAssessmentParameterDetails />,
          },
          'Service Assessment Parameter Details',
        )}
      />
      <Route
        path="/user-guides"
        element={getElementByRole(
          role,
          {
            system_admin: <SystemAdminUserGuides />,
          },
          'User Guides',
        )}
      />
      <Route
        path="/enterprises"
        element={getElementByRole(
          role,
          {
            system_admin: <SystemAdminEnterprises />,
          },
          'Enterprises',
        )}
      />
      <Route
        path="/system-admin-enterprise-details/:id"
        element={getElementByRole(
          role,
          {
            system_admin: <SystemAdminEnterpriseDetails />,
          },
          'Enterprise Details',
        )}
      />
      <Route
        path="/unit-users"
        element={getElementByRole(
          role,
          {
            enterprise_admin: <UnitUsers />,
          },
          'Unit Users',
        )}
      />
      <Route
        path="/manufacturing-assessment-disciplines"
        element={getElementByRole(
          role,
          {
            system_admin: <ManufacturingAssessmentDisciplines />,
          },
          'Manufacturing Assessment Disciplines',
        )}
      />
      <Route
        path="/service-assessment-disciplines"
        element={getElementByRole(
          role,
          {
            system_admin: <ServicesAssessmentDisciplines />,
          },
          'Service Assessment Disciplines',
        )}
      />
      <Route
        path="/system-settings"
        element={getElementByRole(
          role,
          {
            system_admin: <SystemAdminSystemSettings />,
          },
          'System Settings',
        )}
      />
      <Route path="/email-templates" element={getElementByRole(role, { system_admin: <SystemAdminEmailTemplates /> }, 'Email Templates')} />
      <Route path="/email-templates/:id" element={getElementByRole(role, { system_admin: <SystemAdminEmailTemplateEdit /> }, 'Email Templates')} />
      <Route path="/content-blocks" element={getElementByRole(role, { system_admin: <SystemAdminContentBlocks /> }, 'Content & Disclaimers')} />
      <Route path="/email-server" element={getElementByRole(role, { system_admin: <SystemAdminEmailServerSettings /> }, 'Email Server')} />
      <Route path="/branding" element={getElementByRole(role, { system_admin: <SystemAdminBrandingLogos /> }, 'Branding & Logos')} />
      <Route
        path="/audit-logs"
        element={getElementByRole(
          role,
          {
            system_admin: <SystemAdminAuditLog />,
          },
          'Audit Log',
        )}
      />
      <Route
        path="/integration-failures"
        element={getElementByRole(
          role,
          {
            system_admin: <SystemAdminIntegrationFailures />,
          },
          'Integration Failures',
        )}
      />
      {/* Maintenance page - accessible to all roles when system is under maintenance */}
      <Route
        path="/maintenance"
        element={
          <Page title="System Maintenance">
            <Maintenance />
          </Page>
        }
      />
      {/* Fallback: redirect drdo_lab users to their primary view on unmatched routes */}
      <Route path="*" element={role === 'drdo_lab' ? <Navigate to="/certified-vendors" replace /> : null} />
    </Routes>
  );
}
