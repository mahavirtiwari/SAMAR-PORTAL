import Icons from '../../constants/Icons';
import ViewLocation from '../../utils/ViewLocation';
import AppCommonModal from './AppCommonModal';

// punchType: 'IN' | 'OUT'
const AttendanceImageViewModal = ({
  open,
  handleClose,
  image,
  punchType = 'OUT',
  attendeeName = 'N/A',
  attendeeRole = 'N/A',
  dateTime = 'N/A',
  location = 'N/A',
  latitude = 'N/A',
  longitude = 'N/A',
  onViewLocation,
}) => {
  // Determine color based on punchType
  const punchColor = punchType === 'IN' ? 'var(--success-active)' : 'var(--danger-active)';
  const punchLabel = punchType === 'IN' ? 'PUNCH-IN' : 'PUNCH-OUT';
  const modalHeader = (
    <div>
      Attendance Record
      <span style={{ color: punchColor }} className="margin-left-6 fs-16">
        ({punchLabel})
      </span>
    </div>
  );
  const modalContent = (
    <div className="row">
      <div className="col-12 col-md-4">
        {image ? (
          <div>
            <div className="Attendee-image-container">
              <img src={image} alt="Attendance Selfie" style={{ height: '100%', width: '100%' }} />
            </div>
            <div className="margin-top-12 text-center">
              <h2 className="fw-600 fs-20 heading-color mb-0">{attendeeName}</h2>
              <span className="fw-500 fs-14 text-3-color">{attendeeRole}</span>
            </div>
          </div>
        ) : (
          <div>No image available</div>
        )}
      </div>
      <div className="col-12 col-md-8">
        <div className="Attendee-details-container d-flex flex-column justify-content-between">
          <div>
            <div className="d-flex align-items-center">
              <img src={Icons.calendarFill} className="icon-16" />
              <div className="margin-left-6 fs-14 fw-500 text-2-color">
                Date & Time:<span className="margin-left-6 fs-14 fw-600 heading-color">{dateTime}</span>
              </div>
            </div>
            <div className="d-flex align-items-center margin-top-24">
              <img src={Icons.locationGrey} className="at-icon-img me-1" alt="location" />
              <div className="margin-left-6 fs-14 fw-500 text-2-color">
                Location:<span className="margin-left-6 fs-14 fw-600 heading-color">{location}</span>
              </div>
            </div>
            <div className="rowBetween margin-top-24">
              <div className="fs-14 fw-500 text-2-color">
                LAT:<span className="margin-left-6 fs-14 fw-600 heading-color">{latitude}</span>
              </div>
              <div className="fs-14 fw-500 text-2-color">
                LONG:<span className="margin-left-6 fs-14 fw-600 heading-color">{longitude}</span>
              </div>
            </div>
          </div>
          <div className="d-flex justify-content-end align-items-center margin-top-12" style={{ cursor: 'pointer' }} onClick={() => ViewLocation(latitude, longitude)}>
            <span className="fs-14 fw-500 mb-0 primary-color margin-right-2 mt-0">View Location</span>
            <img src={Icons.sendArrow} alt="location" className="icon-16" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={modalHeader}
      modalContent={modalContent}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '400px', lg: '700px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default AttendanceImageViewModal;
