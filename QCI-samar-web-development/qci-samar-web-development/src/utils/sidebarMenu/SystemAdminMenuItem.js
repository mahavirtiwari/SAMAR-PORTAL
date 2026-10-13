import Icons from '../../constants/Icons';

const SystemAdminMenuItem = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: Icons.dashboard,
    activeIcon: Icons.activeDashboard,
    toolTipTitle: 'Dashboard',
    path: '/',
  },
  {
    key: 'operations',
    label: 'Operations',
    icon: Icons.applications,
    activeIcon: Icons.activeApplications,
    toolTipTitle: 'Operations',
    submenu: [
      { key: 'enterprises', label: 'Enterprises', path: '/enterprises' },
      { key: 'applications', label: 'Applications', path: '/applications' },
      { key: 'payment-history', label: 'Payment History', path: '/payment-history' },
      { key: 'certified-vendors', label: 'Certified', path: '/certified-vendors' },
      { key: 'applicant-feedback', label: 'Applicant Feedback', path: '/applicant-feedback' },
    ],
  },
  {
    key: 'user-management',
    label: 'User Management',
    icon: Icons.userManagement,
    activeIcon: Icons.activeUserManagement,
    toolTipTitle: 'User Management',
    submenu: [
      { key: 'assessors', label: 'Assessors', path: '/assessors' },
      { key: 'drdoLabs', label: 'DRDO Labs', path: '/drdo-labs' },
      { key: 'drdoAdmins', label: 'DRDO Admins', path: '/drdo-admins' },
      { key: 'operationsManagers', label: 'Operations Managers', path: '/operations-managers' },
      { key: 'operationsAdmins', label: 'Operations Admins', path: '/operations-admins' },
    ],
  },
  {
    key: 'masterManufacturing',
    label: 'Master (Manufacturing)',
    toolTipTitle: 'Master (Manufacturing)',
    icon: Icons.masterManufacturing,
    activeIcon: Icons.masterManufacturingActive,

    submenu: [
      { key: 'vendorCategories', label: 'Categories', path: '/vendor-categories' },
      { key: 'vendorStores', label: 'Stores', path: '/manufacturing-vendor-stores' },
      { key: 'rawMaterials', label: 'Key Raw Materials', path: '/manufacturing-key-raw-materials' },
      { key: 'boughtOutParts', label: 'Bought-Out Parts', path: '/manufacturing-bought-out-parts' },
      { key: 'keyProcesses', label: 'Key Processes', path: '/manufacturing-key-processes' },
    ],
  },
  {
    key: 'masterServices',
    label: 'Master (Service)',
    icon: Icons.masterService,
    activeIcon: Icons.masterServiceActive,
    toolTipTitle: 'Master (Service)',

    submenu: [
      { key: 'vendorCategories', label: 'Categories', path: '/service-vendor-categories' },
      { key: 'vendorLabs', label: 'Services', path: '/service-vendor-labs' },
      { key: 'keyServices', label: 'Key Service Resources', path: '/key-service-resources' },
      { key: 'outsourcedComponents', label: 'Outsourced Service Components', path: '/outsourced-service-components' },
      { key: 'keyProcesses', label: 'Key Services', path: '/service-key-processes' },
    ],
  },
  {
    key: 'masterCommon',
    label: 'Master (Common)',
    icon: Icons.masterCommon,
    activeIcon: Icons.masterCommonActive,
    toolTipTitle: 'Master (Common)',

    submenu: [
      { key: 'assessorDomain', label: 'Assessor Domains', path: '/assessor-domains' },
      { key: 'thirdPartyCertificate', label: 'Third Party Certificates', path: '/third-party-certificates' },
    ],
  },
  {
    key: 'assessmentManufacturing',
    label: 'Assessment (Manufacturing)',
    icon: Icons.settingsManufacturing,
    activeIcon: Icons.settingsManufacturingActive,
    toolTipTitle: 'Assessment (Manufacturing)',
    submenu: [
      { key: 'assessmentDiscipline', label: 'Assessment Disciplines', path: '/manufacturing-assessment-disciplines' },
      { key: 'assessmentParameters', label: 'Assessment Parameters', path: '/manufacturing-assessment-parameters' },
      { key: 'feeConfiguration', label: 'Fee Configuration', path: '/manufacturing-fee-configuration' },
    ],
  },
  {
    key: 'assessmentServices',
    label: 'Assessment (Service)',
    icon: Icons.settingsService,
    activeIcon: Icons.settingsServiceActive,
    toolTipTitle: 'Assessment (Service)',
    submenu: [
      { key: 'assessmentDiscipline', label: 'Assessment Disciplines', path: '/service-assessment-disciplines' },
      { key: 'assessmentParameters', label: 'Assessment Parameters', path: '/service-assessment-parameters' },
      { key: 'feeConfiguration', label: 'Fee Configuration', path: '/service-fee-configuration' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: Icons.settingSub,
    activeIcon: Icons.activeSettingSub,
    toolTipTitle: 'Settings',
    submenu: [
      { key: 'feedbackConfiguration', label: 'Feedback Configuration', path: '/feedback-configuration' },
      { key: 'systemSettings', label: 'System Settings', path: '/system-settings' },
      { key: 'userGuides', label: 'User Guides', path: '/user-guides' },
      { key: 'auditLog', label: 'Audit Logs', path: '/audit-logs' },
      { key: 'integrationFailures', label: 'Error Logs', path: '/integration-failures' },
    ],
  },
];

export default SystemAdminMenuItem;
