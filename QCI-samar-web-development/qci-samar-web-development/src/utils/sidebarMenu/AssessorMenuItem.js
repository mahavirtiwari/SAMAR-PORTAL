import Icons from '../../constants/Icons';

const AssessorMenuItem = [
  {
    key: 'scheduled',
    label: 'Scheduled',
    icon: Icons.scheduled,
    activeIcon: Icons.scheduledActive,
    toolTipTitle: 'Scheduled',
    path: '/scheduled',
  },

  {
    key: 'in-progress',
    label: 'In Progress',
    icon: Icons.inProgress,
    activeIcon: Icons.inProgressActive,
    toolTipTitle: 'In Progress',
    path: '/in-progress',
  },

  {
    key: 'quality-check',
    label: 'Quality Check',
    icon: Icons.qualityChecks,
    activeIcon: Icons.qualityCheckActive,
    toolTipTitle: 'Quality Check',
    path: '/quality-check',
  },

  {
    key: 'quality-check-feedback',
    label: 'Quality Check Feedback',
    icon: Icons.qualityCheckFeedback,
    activeIcon: Icons.qualityCheckFeedbackActive,
    toolTipTitle: 'Quality Check Feedback',
    path: '/quality-check-feedback',
  },

  {
    key: 'ready-for-committee-review',
    label: 'Ready for Committee Review',
    icon: Icons.readyCommitteeReviews,
    activeIcon: Icons.readyCommitteeReviewsActive,
    toolTipTitle: 'Ready for Committee Review',
    path: '/ready-for-committee-review',
  },

  {
    key: 'committee-review-scheduled',
    label: 'Committee Review Scheduled',
    icon: Icons.committeeReviewScheduled,
    activeIcon: Icons.committeeReviewScheduledActive,
    toolTipTitle: 'Committee Review Scheduled',
    path: '/committee-review-scheduled',
  },

  {
    key: 'committee-review-feedback',
    label: 'Committee Review Feedback',
    icon: Icons.committeeReviewFeedback,
    activeIcon: Icons.committeeReviewFeedbackActive,
    toolTipTitle: 'Committee Review Feedback',
    path: '/committee-review-feedback',
  },

  {
    key: 'certified',
    label: 'Certified',
    icon: Icons.certifieds,
    activeIcon: Icons.certifiedsActive,
    toolTipTitle: 'Certified',
    path: '/certified',
  },
];

export default AssessorMenuItem;
