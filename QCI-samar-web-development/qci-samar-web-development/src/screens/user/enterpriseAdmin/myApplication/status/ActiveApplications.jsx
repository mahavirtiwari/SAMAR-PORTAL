import ApplicationStatus from './ApplicationStatus';

// Enterprise Admin – Active Applications. "Active" mirrors the dashboard count:
// every application except draft, certified and rejected.
const ActiveApplications = () => {
  return <ApplicationStatus excludeStatus="draft,certified,rejected" heading="Active Applications" />;
};

export default ActiveApplications;
