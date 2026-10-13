import Icons from '../../constants/Icons';

const EnterpriseAdminMenuItem = [
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
    label: 'My Applications',
    icon: Icons.applications,
    activeIcon: Icons.activeApplications,
    toolTipTitle: 'My Applications',
    path: '/applications',
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
    key: 'unit-users',
    label: 'Unit Users',
    icon: Icons.activeUserAdmin,
    activeIcon: Icons.userAdmin,
    toolTipTitle: 'Unit Users',
    path: '/unit-users',
  },

  {
    key: 'unit-rating-feedbacks',
    label: 'Feedback',
    icon: Icons.feedback,
    activeIcon: Icons.activeFeedback,
    toolTipTitle: 'Feedback',
    path: '/rating-feedback',
  },
  {
    key: 'documents',
    label: 'Certificates & Reports',
    icon: Icons.myDocument,
    activeIcon: Icons.activeMyDocument,
    toolTipTitle: 'Certificates & Reports',
    path: '/documents',
  },
  {
    key: 'enterprise-profile',
    label: 'Enterprise Profile',
    icon: Icons.enterprises,
    activeIcon: Icons.activeEnterprises,
    toolTipTitle: 'Enterprise Profile',
    path: '/organisation-profile',
  },
  {
    key: 'support',
    label: 'Support',
    icon: Icons.support,
    activeIcon: Icons.activeSupport,
    toolTipTitle: 'Support',
    path: '/support',
  },
];

export default EnterpriseAdminMenuItem;
