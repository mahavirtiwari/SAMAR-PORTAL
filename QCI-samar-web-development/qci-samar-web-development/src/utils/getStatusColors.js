// Utility to map status label to AppBadge variant

/**
 * Returns the AppBadge variant based on the provided label.
 * @param {string} label - The status label.
 * @returns {string} - The variant for AppBadge.
 */
export function getBadgeVariantByLabel(label) {
  if (!label) {
    return 'grey';
  }
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '_');
  switch (normalized) {
    // Application statuses (snake_case from backend)
    case 'draft':
      return 'grey';
    case 'drdo_approval_pending':
      return 'yellow';
    case 'payment_pending':
      return 'orange';
    case 'payment_completed':
      return 'green';
    case 'in_progress':
      return 'lightBlue';
    case 'mobile_complete':
      return 'lightBlue';
    case 'certified':
      return 'purple';
    case 'rejected':
      return 'red';

    // Assessment statuses
    case 'allocation_pending':
      return 'yellow';
    case 'scheduled':
      return 'blue';
    case 'rescheduled':
      return 'orange';
    case 'submitted_for_qc':
      return 'lightBlue';
    case 'quality_check':
      return 'purple';
    case 'qc_feedback':
    case 'quality_check_feedback':
      return 'brown';
    case 'ready_for_committee':
    case 'ready_for_committee_review':
      return 'darkGreen';
    case 'committee_review':
    case 'committee_review_scheduled':
      return 'purple';
    case 'committee_feedback':
    case 'committee_review_feedback':
    case 'feedback':
      return 'brown';

    // Committee roles
    case 'chair_person':
      return 'green';
    case 'convenor':
      return 'orange';
    case 'member':
      return 'lightBlue';

    // Clarification statuses
    case 'clarification_required':
    case 'clarificationrequired':
      return 'orange';
    case 'responded':
      return 'lightBlue';
    case 'pending':
      return 'yellow';
    case 'completed':
      return 'green';
    case 'feedback_submitted':
    case 'feedbacksubmitted':
      return 'darkGreen';

    // User statuses
    case 'invited':
      return 'yellow';
    case 'active':
      return 'green';
    case 'inactive':
      return 'red';
    case 'expired':
      return 'red';
    case 'pending_details':
      return 'yellow';
    case 'Pending Review':
      return 'yellow';

    // Payment statuses
    case 'success':
      return 'green';
    case 'failed':
      return 'red';

    default:
      return 'grey';
  }
}

/**
 * Returns a human-friendly label for a given status key/label.
 * Falls back to capitalized words of the input if no mapping exists.
 * @param {string} label - The status label or key.
 * @returns {string} - Human-friendly label for UI.
 */
export function getStatusLabel(label) {
  if (!label && label !== 0) {
    return '-';
  }
  const normalized = String(label)
    .trim()
    .toLowerCase()
    // .replace(/[\u0000-\u001F]+/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  switch (normalized) {
    case 'payment_pending':
    case 'payment pending':
      return 'Payment Pending';
    case 'payment_completed':
    case 'payment completed':
      return 'Payment Completed';
    case 'drdo_approval_pending':
    case 'drdo approval pending':
      return 'DRDO Approval Pending';
    case 'in_progress':
    case 'in progress':
      return 'In Progress';
    case 'mobile_complete':
    case 'mobile complete':
      return 'Completed on Mobile';
    case 'certified':
      return 'Certified';
    case 'rejected':
      return 'Rejected';
    case 'draft':
      return 'Draft';
    case 'scheduled':
      return 'Scheduled';
    case 'rescheduled':
      return 'Rescheduled';
    case 'allocation_pending':
    case 'allocation pending':
      return 'Allocation Pending';
    case 'submitted_for_qc':
    case 'submitted for qc':
      return 'Submitted for QC';
    case 'quality_check':
    case 'quality check':
      return 'Quality Check';
    case 'qc_feedback':
    case 'qc feedback':
      return 'QC Feedback';
    case 'ready_for_committee_review':
    case 'ready for committee review':
      return 'Ready for Committee Review';
    case 'committee_review_scheduled':
    case 'committee review scheduled':
      return 'Committee Review Scheduled';
    case 'committee_review_feedback':
    case 'committee review feedback':
      return 'Committee Review Feedback';
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    case 'invited':
      return 'Invited';
    case 'pending':
      return 'Pending';
    case 'completed':
      return 'Completed';
    case 'clarification_required':
    case 'clarification required':
      return 'Clarification Required';
    case 'feedback_submitted':
    case 'feedback submitted':
      return 'Feedback Submitted';
    case 'success':
      return 'Success';
    case 'failed':
      return 'Failed';
    default:
      // Fallback: capitalize each word
      return normalized
        .split(' ')
        .map(word => (word ? word[0].toUpperCase() + word.slice(1) : ''))
        .join(' ');
  }
}
