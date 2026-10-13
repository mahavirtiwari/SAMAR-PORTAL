import AppSiteTourCard from '../../../../../components/base/AppSiteTourCard';
import { formatDate } from '../../../../../utils/formatters';

const SiteTourTab = ({ siteTour, loading }) => {
  if (loading) {
    return <div className="details-card text-center p-4">Loading...</div>;
  }

  const pictures = siteTour?.pictures || [];

  if (!pictures.length) {
    return <div className="details-card text-center p-4">No site tour pictures available.</div>;
  }

  return (
    <div className="details-card">
      <div className="enterpriseInfoMainWrapper">
        <h4 className="fs-20 fw-600 heading-color">Site Tour ({siteTour?.totalCount || pictures.length} pictures)</h4>
        <div className="leadership-mindset-content">
          {pictures.map((picture, idx) => (
            <div key={picture.id || idx} className="site-tour-img-item">
              <AppSiteTourCard
                picture={picture}
                lat={picture.latitude}
                long={picture.longitude}
                dateString={picture.capturedAt ? formatDate(picture.capturedAt) : '-'}
                uploader={picture.uploadedBy?.name || 'Applicant'}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SiteTourTab;
