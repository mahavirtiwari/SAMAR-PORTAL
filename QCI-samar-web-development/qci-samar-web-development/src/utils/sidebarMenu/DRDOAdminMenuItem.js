import Icons from '../../constants/Icons';

const DRDOAdminMenuItem = [
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
    toolTipTitle: 'Applications',
    path: '/applications',
    active: true,
  },
  {
    key: 'pending-approval',
    label: 'Pending Approval',
    icon: Icons.pendingApprovals,
    activeIcon: Icons.activePendingApprovals,
    toolTipTitle: 'Pending Approval',
    path: '/pending-approval',
  },
  {
    key: 'view-assessments',
    label: 'View Assessments',
    icon: Icons.manageAssessments,
    activeIcon: Icons.activeManageAssessments,
    toolTipTitle: 'View Assessments',
    submenu: [
      { key: 'allocation-pending', label: 'Allocation Pending', path: '/allocation-pending' },
      { key: 'scheduled', label: 'Scheduled', path: '/scheduled' },
      { key: 'in-progress', label: 'In Progress', path: '/in-progress' },
      { key: 'quality-check', label: 'Quality Check', path: '/quality-check' },
      { key: 'quality-check-feedback', label: 'Quality Check Feedback', path: '/quality-check-feedback' },
      { key: 'ready-for-committee-review', label: 'Ready for Committee Review', path: '/ready-for-committee-review' },
      { key: 'committee-review-scheduled', label: 'Committee Review Scheduled', path: '/committee-review-scheduled' },
      { key: 'committee-review-feedback', label: 'Committee Review Feedback', path: '/committee-review-feedback' },
      { key: 'certified', label: 'Certified', path: '/certified' },
    ],
    path: '/payment-history',
  },
  {
    key: 'certified-vendors',
    label: 'Certified',
    icon: Icons.certifiedVendors,
    activeIcon: Icons.activeCertifiedVendors,
    toolTipTitle: 'Certified',
    path: '/certified-vendors',
  },
];

export default DRDOAdminMenuItem;
