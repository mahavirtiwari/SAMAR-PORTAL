import ApplicationStatus from './ApplicationStatus';

// Enterprise Admin – Pending Applications. Reuses the shared ApplicationStatus list,
// locked to the pending status. Adjust the `status` value if the backend uses a
// different status key for "pending".
const PendingApplications = () => {
  return <ApplicationStatus status="drdo_approval_pending" heading="Pending Applications" />;
};

export default PendingApplications;
