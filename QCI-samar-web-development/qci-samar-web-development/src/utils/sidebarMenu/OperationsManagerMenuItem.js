import Icons from '../../constants/Icons';

const OperationsManagerMenuItem = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: Icons.dashboard,
    activeIcon: Icons.activeDashboard,
    toolTipTitle: 'Dashboard',
    path: '/',
  },
  {
    key: 'applications',
    label: 'Applications',
    icon: Icons.applications,
    activeIcon: Icons.activeApplications,
    path: '/applications',
    toolTipTitle: 'Applications',
    active: true,
  },
  {
    key: 'payment-history',
    label: 'Payment History',
    icon: Icons.paymentHistory,
    activeIcon: Icons.activePaymentHistory,
    toolTipTitle: 'Payment History',
    path: '/payment-history',
  },

  {
    key: 'manage-assessments',
    label: 'Manage Assessments',
    icon: Icons.manageAssessments,
    activeIcon: Icons.activeManageAssessments,
    toolTipTitle: 'Manage Assessments',
    submenu: [
      { key: 'allocation-list', label: 'Allocation Pending', path: '/allocation-pending' },
      { key: 'scheduled', label: 'Scheduled', path: '/scheduled' },
      { key: 'in-progress', label: 'In Progress', path: '/in-progress' },
      { key: 'quality-check', label: 'Quality Check', path: '/quality-check' },
      { key: 'quality-check-feedback', label: 'Quality Check Feedback', path: '/quality-check-feedback' },
      { key: 'ready-for-committee-review', label: 'Ready for Committee Review', path: '/ready-for-committee-review' },
      { key: 'committee-review-scheduled', label: 'Committee Review Scheduled', path: '/committee-review-scheduled' },
      { key: 'committee-review-feedback', label: 'Committee Review Feedback', path: '/committee-review-feedback' },
      { key: 'certified', label: 'Certified', path: '/certified' },
    ],
  },

  {
    key: 'certified-vendors',
    label: 'Certified',
    icon: Icons.certifiedVendors,
    activeIcon: Icons.activeCertifiedVendors,
    toolTipTitle: 'Certified',
    path: '/certified-vendors',
  },
  {
    key: 'assessors',
    label: 'Assessors',
    icon: Icons.accessor,
    activeIcon: Icons.activeAccessor,
    toolTipTitle: 'Assessors',
    path: '/assessors',
  },
  {
    key: 'applicant-feedback',
    label: 'Applicant Feedback',
    icon: Icons.feedback,
    activeIcon: Icons.activeFeedback,
    toolTipTitle: 'Applicant Feedback',
    path: '/applicant-feedback',
  },
];

export default OperationsManagerMenuItem;
