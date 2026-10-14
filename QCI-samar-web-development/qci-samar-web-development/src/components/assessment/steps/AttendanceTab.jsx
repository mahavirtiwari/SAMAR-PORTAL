import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { ASSESSMENT_STATUS } from '../../../constants/assessmentStatus';
import Icons from '../../../constants/Icons';
import useLiveRefresh from '../../../hooks/useLiveRefresh';
import { getAttendanceAction, getMyAssignmentsAction, getMyPunchStatusAction } from '../../../redux/action/common/ApplicationAssessmentAction';
import { isServiceSector, resolveTeamRole } from '../../../utils/assessmentExecution';
import { fetchAuthenticatedImageUrl } from '../../../utils/FileUtils';
import { formatDate, formatTime } from '../../../utils/formatters';
import { AppAvatar } from '../../base';
import AttendanceImageViewModal from '../../modals/AttendanceImageViewModal';
import PunchModal from '../../modals/PunchModal';

const AttendanceRow = ({ record, punchIn, punchOut, imageUrls = {}, onAvatarClick }) => {
  const getInitials = name => {
    if (!name) {
      return '';
    }
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };
  const formatTimeValue = dateString => {
    if (!dateString) {
      return '--';
    }
    return formatTime(dateString);
  };

  const formatCoords = (lat, lng) => {
    if (!lat || !lng) {
      return { lat: '--', lng: '--' };
    }
    return {
      lat: parseFloat(lat).toFixed(6),
      lng: parseFloat(lng).toFixed(6),
    };
  };

  const punchInCoords = formatCoords(punchIn?.latitude, punchIn?.longitude);
  const punchOutCoords = formatCoords(punchOut?.latitude, punchOut?.longitude);

  return (
    <div className="at-row">
      <div className="at-left">
        <div className="at-person">
          <div className="at-person-meta">
            <div className="at-name">{record.name}</div>
            <div className="at-role">{record.role}</div>
          </div>
        </div>
      </div>

      <div className="at-mid">
        <div className="at-check-block">
          <div className="at-check-label in">Punch-In</div>
          <AppAvatar
            src={imageUrls[punchIn?.selfieUrl]}
            alt="user"
            size="36"
            style={{ cursor: punchIn?.selfieUrl ? 'pointer' : 'default' }}
            onClick={() =>
              punchIn?.selfieUrl &&
              onAvatarClick({
                image: imageUrls[punchIn.selfieUrl],
                punchType: 'IN',
                punchRecord: punchIn,
                name: record.name,
                role: record.role,
                location: record.location,
              })
            }>
            {getInitials(record.name)}
          </AppAvatar>
          <div className="at-check-info">
            <div className="at-time">
              <img src={Icons.clockGrey} className="at-icon-img me-1" alt="clock" />
              {formatTimeValue(punchIn?.recordedAt)}
            </div>
            <div className="at-location">
              <img src={Icons.locationGrey} className="at-icon-img me-1" alt="location" />
              {record.location || 'Location not available'}
            </div>
            <div className="at-coords">
              <span className="lat">LAT:</span> {punchInCoords.lat} &nbsp; <span className="lat">LONG:</span> {punchInCoords.lng}
            </div>
          </div>
        </div>

        <div className="at-connector">
          <div className="dot" />
          <div className="line" />
          <div className="dot" />
        </div>

        <div className="at-check-block">
          <div className="at-check-label out">Punch-Out</div>
          <AppAvatar
            src={imageUrls[punchOut?.selfieUrl]}
            alt="user"
            size="36"
            style={{ cursor: punchOut?.selfieUrl ? 'pointer' : 'default' }}
            onClick={() =>
              punchOut?.selfieUrl &&
              onAvatarClick({
                image: imageUrls[punchOut.selfieUrl],
                punchType: 'OUT',
                punchRecord: punchOut,
                name: record.name,
                role: record.role,
                location: record.location,
              })
            }>
            {getInitials(record.name)}
          </AppAvatar>

          <div className="at-check-info">
            <div className="at-time">
              <img src={Icons.clockGrey} className="at-icon-img me-1" alt="clock" />
              {formatTimeValue(punchOut?.recordedAt)}
            </div>
            <div className="at-location">
              <img src={Icons.locationGrey} className="at-icon-img me-1" alt="location" />
              {record.location || 'Location not available'}
            </div>
            <div className="at-coords">
              <span className="lat">LAT:</span> {punchOutCoords.lat} &nbsp; <span className="lat">LONG:</span> {punchOutCoords.lng}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Shared AttendanceTab component
 * Displays punch-in/punch-out records, and — for a service-sector team member on
 * an editable assessment — exposes web punch-in/out capture.
 */
const AttendanceTab = ({ assessment: assessmentProp }) => {
  const dispatch = useDispatch();
  const { id } = useParams();

  const { user } = useSelector(state => state.Account);
  const assessmentFromStore = useSelector(state => state.Assessment?.assessment);
  const assessmentData = assessmentProp || assessmentFromStore?.data?.assessment || assessmentFromStore?.assessment || assessmentFromStore;

  const { attendance, attendanceLoading, attendanceError, punchStatus, myAssignments } = useSelector(state => state.ApplicationAssessment);
  // Flattened attendance array for processing
  const attendances = attendance?.attendances || attendance || [];

  const { isTeamMember, isCoAssessor } = resolveTeamRole(assessmentData, user?.id);
  // Backend attendance endpoints accept only scheduled/in_progress; a member is
  // punched out well before mobile_complete, so capture is hidden past that.
  const statusEditable = assessmentData?.status === ASSESSMENT_STATUS.SCHEDULED || assessmentData?.status === ASSESSMENT_STATUS.IN_PROGRESS;
  const canPunch = isTeamMember && isServiceSector(assessmentData) && statusEditable;

  const isPunchedIn = !!(punchStatus?.isPunchedIn ?? punchStatus?.is_punched_in);
  const _lastPunch = punchStatus?.lastAttendance || punchStatus?.last_attendance;
  // A co-assessor cannot punch in until the lead has allocated at least one parameter.
  const assignedCount = myAssignments?.count ?? myAssignments?.parameters?.length ?? 0;
  const coAssessorBlocked = isCoAssessor && assignedCount === 0;
  // Punch-in is date-gated: it only opens on the assessment's scheduled start date.
  const scheduledStartDate = assessmentData?.scheduledStartDate;
  const punchWindowOpen = !scheduledStartDate || !dayjs().startOf('day').isBefore(dayjs(scheduledStartDate).startOf('day'));

  const [punchModal, setPunchModal] = useState({ open: false, mode: 'in' });

  const _openPunch = mode => setPunchModal({ open: true, mode });
  const closePunch = () => setPunchModal(prev => ({ ...prev, open: false }));
  const handlePunchSuccess = () => {
    dispatch(getMyPunchStatusAction(id));
    dispatch(getAttendanceAction(id));
  };

  // Preloaded blob URLs for selfies: map originalUrl -> blobUrl
  const [imageUrls, setImageUrls] = useState({});
  const imageBlobRef = useRef({});
  // Modal state for AttendanceImageViewModal
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [modalData, setModalData] = useState({});

  const handleAvatarClick = ({ image, punchType, punchRecord, name, role, location }) => {
    setModalData({
      image,
      attendeeName: name || '',
      attendeeRole: role || '',
      dateTime: punchRecord?.recordedAt ? `${formatDate(punchRecord.recordedAt)}, ${formatTime(punchRecord.recordedAt)}` : '',
      location: location || '',
      latitude: punchRecord?.latitude,
      longitude: punchRecord?.longitude,
      punchType,
    });
    setImageModalOpen(true);
  };

  useEffect(() => {
    if (id) {
      dispatch(getAttendanceAction(id));
    }
  }, [dispatch, id]);

  // Punch selfies synced from the assessors' phones appear without a reload.
  useLiveRefresh(() => dispatch(getAttendanceAction({ assessmentId: id, silent: true })), { enabled: !!id });

  useEffect(() => {
    if (id && canPunch) {
      dispatch(getMyPunchStatusAction(id));
      dispatch(getMyAssignmentsAction(id));
    }
  }, [dispatch, id, canPunch]);

  // Preload selfie images (authenticated) for all attendance records
  useEffect(() => {
    const allRecords = attendances || [];
    const urls = Array.from(new Set(allRecords.flatMap(r => [r.selfieUrl, r.selfie_url, r.punchIn?.selfieUrl, r.punchOut?.selfieUrl].filter(Boolean))));

    let mounted = true;

    const loadAll = async () => {
      const map = {};
      for (const u of urls) {
        if (!u) {
          continue;
        }
        try {
          const blob = await fetchAuthenticatedImageUrl(u);
          if (blob && mounted) {
            imageBlobRef.current[u] = blob;
            map[u] = blob;
          }
        } catch {
          // ignore per-image failures
        }
      }
      if (mounted) {
        setImageUrls(map);
      }
    };

    if (urls.length > 0) {
      loadAll();
    }

    return () => {
      mounted = false;
      Object.values(imageBlobRef.current).forEach(b => {
        try {
          URL.revokeObjectURL(b);
        } catch {
          // ignore
        }
      });
      imageBlobRef.current = {};
      setImageUrls({});
    };
  }, [attendances]);

  // Group attendances by date
  const groupedByDate = {};
  attendances.forEach(record => {
    const date = formatDate(record.recordedAt);
    if (!groupedByDate[date]) {
      groupedByDate[date] = [];
    }
    groupedByDate[date].push(record);
  });

  // Further group by team member and pair punch_in/punch_out
  const processedData = Object.entries(groupedByDate).map(([date, records]) => {
    const byMember = {};
    records.forEach(r => {
      const memberId = r.teamMemberId;
      if (!byMember[memberId]) {
        byMember[memberId] = {
          name: r.teamMember?.user?.firstName || r.teamMember?.user?.name || 'Unknown',
          role: r.teamMember?.role === 'lead_assessor' ? 'Lead Assessor' : r.teamMember?.role === 'co_assessor' ? 'Co-Assessor' : 'Assessor',
          location: isServiceSector(assessmentData) ? 'Remote Assessment' : 'Assessment Site',
          punchIn: null,
          punchOut: null,
        };
      }
      if (r.type === 'punch_in') {
        byMember[memberId].punchIn = r;
      } else if (r.type === 'punch_out') {
        byMember[memberId].punchOut = r;
      }
    });

    return {
      date,
      records: Object.values(byMember),
    };
  });
  // Calculate date range
  const dates = Object.keys(groupedByDate).sort((a, b) => dayjs(a, 'D MMM YYYY').diff(dayjs(b, 'D MMM YYYY')));
  const dateRange = dates.length > 0 ? `${formatDate(dates[0])} - ${formatDate(dates[dates.length - 1])}` : '';

  const punchSection = canPunch ? (
    <div className="punch-action-bar d-flex flex-wrap align-items-center justify-content-between gap-3 margin-bottom-16">
      <div>
        {coAssessorBlocked && <div className="fs-12 fw-500 text-3-color">Waiting for the Lead Assessor to allocate parameters to you.</div>}
        {!isPunchedIn && !coAssessorBlocked && !punchWindowOpen && <div className="fs-12 fw-500 text-3-color">Punch-in opens on the start date. Available from {formatDate(scheduledStartDate)}.</div>}
      </div>
    </div>
  ) : null;

  return (
    <div className="attendance-card">
      <div className="attendance-header">
        <h3>Attendance Records</h3>
        {dateRange && (
          <div className="range-chip attendance-range">
            <img src={Icons.calendarFill} width="20" alt="calendar" />
            <div className="range-text">{dateRange}</div>
          </div>
        )}
      </div>

      {punchSection}

      {attendanceLoading ? (
        <div className="d-flex justify-content-center align-items-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : attendanceError ? (
        <div className="alert alert-danger" role="alert">
          Failed to load attendance: {attendanceError?.message || 'Unknown error'}
        </div>
      ) : attendances.length === 0 ? (
        <div className="text-center py-5">
          <p className="text-muted">No attendance records yet</p>
        </div>
      ) : (
        processedData.map(day => (
          <div className="attendance-day" key={day.date}>
            <div className="attendance-day-label">
              <img src={Icons.calendarBlue} className="dateCalender" alt="calendar" /> {formatDate(day.date)}
            </div>
            <div className="attendance-list">
              {day.records.map((r, idx) => (
                <React.Fragment key={r.name + idx}>
                  <AttendanceRow record={r} punchIn={r.punchIn} punchOut={r.punchOut} imageUrls={imageUrls} onAvatarClick={handleAvatarClick} />
                  <div className="at-separator" />
                </React.Fragment>
              ))}
            </div>
          </div>
        ))
      )}
      <AttendanceImageViewModal open={imageModalOpen} handleClose={() => setImageModalOpen(false)} {...modalData} />
      <PunchModal open={punchModal.open} onClose={closePunch} mode={punchModal.mode} assessmentId={id} onSuccess={handlePunchSuccess} />
    </div>
  );
};

export default AttendanceTab;
