const AppEmptyState = ({ emptyStateImage, emptyStateHeading, emptyStateSubHeading }) => {
  return (
    <div className="app-empty-state">
      <img src={emptyStateImage} alt="No results found" className="empty-img" />
      <h4 className="fs-xl fw-600 heading-color mb-0 margin-top-32">{emptyStateHeading}</h4>
      <p className="fs-base fw-400 text-2-color mb-0 margin-top-15 empty-state-subheading">{emptyStateSubHeading}</p>
    </div>
  );
};
export default AppEmptyState;
