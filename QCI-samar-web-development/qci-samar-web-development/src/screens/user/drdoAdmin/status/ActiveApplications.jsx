import ApplicationStatus from './ApplicationStatus';

const ActiveApplications = () => {
  return <ApplicationStatus excludeStatus="draft,certified,rejected" heading="Active Applications" />;
};

export default ActiveApplications;
