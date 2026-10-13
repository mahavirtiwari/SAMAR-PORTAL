import Icons from '../../constants/Icons';

const UnitAdminMenuItem = [
  {
    key: 'applications',
    label: 'My Applications',
    icon: Icons.applications,
    activeIcon: Icons.activeApplications,
    path: '/applications',
    toolTipTitle: 'My Applications',
    active: true,
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
    key: 'support',
    label: 'Support',
    icon: Icons.support,
    activeIcon: Icons.activeSupport,
    toolTipTitle: 'Support',
    path: '/support',
  },
];

export default UnitAdminMenuItem;
