import ApplicationStatus from './ApplicationStatus';

// Enterprise Admin – Draft Applications. Reuses the shared ApplicationStatus list,
// locked to the draft status.
const DraftApplications = () => {
  return <ApplicationStatus status="draft" heading="Draft Applications" />;
};

export default DraftApplications;
