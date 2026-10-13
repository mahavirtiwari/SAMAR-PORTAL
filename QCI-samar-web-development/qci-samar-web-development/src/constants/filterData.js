export const applicationStatusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'drdo_approval_pending', label: 'DRDO Approval Pending' },
  { value: 'payment_pending', label: 'Payment Pending' },
  { value: 'payment_completed', label: 'Payment Completed' },

  { value: 'in_progress', label: 'In Progress' },

  { value: 'certified', label: 'Certified' },
  { value: 'rejected', label: 'Rejected' },
];

export const sectorOptions = [
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'service', label: 'Service' },
];

// Certified module "Stores / Services" filter — Stores = manufacturing sector, Services = service sector.
export const storesServicesOptions = [
  { value: 'manufacturing', label: 'Stores' },
  { value: 'service', label: 'Services' },
];
export const ratingOptions = [
  { value: '', label: 'Select Rating' },
  { value: 'Level 1', label: 'Level 1' },
  { value: 'Level 2', label: 'Level 2' },
  { value: 'Level 3', label: 'Level 3' },
  { value: 'Level 4', label: 'Level 4' },
  { value: 'Level 5', label: 'Level 5' },
];
export const classificationOptions = [
  { value: 'startup', label: 'Start-Up' },
  { value: 'micro', label: 'Micro' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

// Fresh applications carry applicationType 'new'; renewals carry 'renewal'. Empty value = All.
export const applicationTypeOptions = [
  { value: 'new', label: 'Fresh' },
  { value: 'renewal', label: 'Renewal' },
];

export const ownershipTypeOptions = [
  { value: 'proprietorship', label: 'Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'private_limited', label: 'Private Limited' },
  { value: 'public_limited', label: 'Public Limited' },
  { value: 'limited_liability_partnership', label: 'Limited Liability Partnership' },
  { value: 'joint_venture', label: 'Joint Venture' },
];
