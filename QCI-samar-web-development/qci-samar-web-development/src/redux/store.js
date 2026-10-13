import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { injectAuthActions, injectStore } from '../services/api/clients/userClient';
import { logoutUserAction, refreshTokenAction } from './action/common/AccountAction';
import AccountSlice from './slices/common/AccountSlice';
import ApplicationAssessmentSlice from './slices/common/ApplicationAssessmentSlice';
import ApplicationFeedbackSlice from './slices/common/ApplicationFeedbackSlice';
import assessmentSlice from './slices/common/AssessmentSlice';
import documentSlice from './slices/common/DocumentSlice';
import feeConfigSlice from './slices/common/FeeConfigSlice';
import SystemSettingSlice from './slices/common/SystemSettingsSlice';
import SystemStatusSlice, { setMaintenanceMode } from './slices/common/SystemStatusSlice';
import UnitAdminSlice from './slices/common/UnitAdminSlice';
import drdoAdminApplicationSlice from './slices/drdoAdmin/application/ApplicationSlice';
import DRDOAdminDashboardSlice from './slices/drdoAdmin/DashboardSlice';
import drdoAdminPaymentSlice from './slices/drdoAdmin/payment/PaymentSlice';
import ApplicationSlice from './slices/enterpriseAdmin/application/ApplicationSlice';
import CertificateSlice from './slices/enterpriseAdmin/CertificateSlice';
import EnterpriseAdminDashboardSlice from './slices/enterpriseAdmin/DashboardSlice';
import PaymentSlice from './slices/enterpriseAdmin/payment/PaymentSlice';
import SupportSlice from './slices/enterpriseAdmin/SupportSlice';
import UnitSlice from './slices/enterpriseAdmin/Unit/UnitSlice';
import MasterSlice from './slices/master/MasterSlice';
import operationsAdminApplicationSlice from './slices/operationsAdmin/application/ApplicationSlice';
import CommitteeMeetingSlice from './slices/operationsAdmin/CommitteeMeetingSlice';
import CommitteeMemberSlice from './slices/operationsAdmin/CommitteeMemberSlice';
import operationsAdminDashboardSlice from './slices/operationsAdmin/DashboardSlice';
import operationsAdminPaymentSlice from './slices/operationsAdmin/payment/PaymentSlice';
import operationsManagerApplicationSlice from './slices/operationsManager/application/ApplicationSlice';
import operationsManagerDashboardSlice from './slices/operationsManager/DashboardSlice';
import operationsManagerPaymentSlice from './slices/operationsManager/payment/PaymentSlice';
import OrganizationSlice from './slices/organizations/OrganizationSlice';
import assessmentParameterSlice from './slices/systemAdmin/AssessmentParameterSlice';
import systemAdminApplicationSlice from './slices/systemAdmin/application/ApplicationSlice';
import systemAdminAuditLogSlice from './slices/systemAdmin/auditLog/AuditLogSlice';
import dashboardSlice from './slices/systemAdmin/DashboardSlice';
import SystemAdminDisciplines from './slices/systemAdmin/DisciplinesSlice';
import enterprisesSlice from './slices/systemAdmin/EnterprisesSlice';
import feedbackSlice from './slices/systemAdmin/FeedbackSlice';
import systemAdminIntegrationFailureSlice from './slices/systemAdmin/integrationFailure/IntegrationFailureSlice';
import systemAdminPaymentSlice from './slices/systemAdmin/payment/PaymentSlice';
import unitAdminApplicationSlice from './slices/unitAdmin/application/ApplicationSlice';
import UnitAdminCertificateSlice from './slices/unitAdmin/CertificateSlice';
import UnitAdminPaymentSlice from './slices/unitAdmin/payment/PaymentSlice';
import UnitAdminSupportSlice from './slices/unitAdmin/SupportSlice';

const appReducer = combineReducers({
  Account: AccountSlice,
  ApplicationAssessment: ApplicationAssessmentSlice,
  ApplicationFeedback: ApplicationFeedbackSlice,
  DRDOAdminDashboard: DRDOAdminDashboardSlice,
  DrdoAdminApplication: drdoAdminApplicationSlice,
  DrdoAdminPayment: drdoAdminPaymentSlice,
  OperationsAdminApplication: operationsAdminApplicationSlice,
  OperationsAdminPayment: operationsAdminPaymentSlice,
  OperationsManagerApplication: operationsManagerApplicationSlice,
  OperationsManagerPayment: operationsManagerPaymentSlice,
  Organization: OrganizationSlice,
  UnitAdmin: UnitAdminSlice,
  Unit: UnitSlice,
  SystemAdminApplication: systemAdminApplicationSlice,
  SystemAdminPayment: systemAdminPaymentSlice,
  Assessment: assessmentSlice,
  SystemAdminDashboard: dashboardSlice,
  SystemAdminDocument: documentSlice,
  SystemAdminEnterprises: enterprisesSlice,
  SystemAdminFeeConfig: feeConfigSlice,
  SystemAdminFeedback: feedbackSlice,
  EnterpriseAdminApplication: ApplicationSlice,
  UnitAdminApplication: unitAdminApplicationSlice,
  EnterpriseAdminDashboard: EnterpriseAdminDashboardSlice,
  EnterpriseAdminPayment: PaymentSlice,
  SystemAdminDisciplines: SystemAdminDisciplines,
  SystemAdminAssessmentParameter: assessmentParameterSlice,
  SystemAdminAuditLog: systemAdminAuditLogSlice,
  SystemAdminIntegrationFailure: systemAdminIntegrationFailureSlice,
  SystemSetting: SystemSettingSlice,
  SystemStatus: SystemStatusSlice,
  EnterpriseAdminSupport: SupportSlice,
  EnterpriseAdminCertificate: CertificateSlice,
  OperationsManagerDashboard: operationsManagerDashboardSlice,
  OperationsAdminDashboard: operationsAdminDashboardSlice,
  CommitteeMeeting: CommitteeMeetingSlice,
  CommitteeMember: CommitteeMemberSlice,
  Master: MasterSlice,
  UnitAdminSupport: UnitAdminSupportSlice,
  UnitAdminCertificate: UnitAdminCertificateSlice,
  UnitAdminPayment: UnitAdminPaymentSlice,
});

// Root reducer that resets all state on logout
const rootReducer = (state, action) => {
  // When logout action is fulfilled, reset the entire store to initial state
  if (action.type === logoutUserAction.fulfilled.type) {
    state = undefined;
  }
  return appReducer(state, action);
};

const store = configureStore({
  reducer: rootReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

// Inject the store into userClient for token refresh functionality
injectStore(store);
injectAuthActions({ logoutUserAction, refreshTokenAction, setMaintenanceMode });

export default store;
