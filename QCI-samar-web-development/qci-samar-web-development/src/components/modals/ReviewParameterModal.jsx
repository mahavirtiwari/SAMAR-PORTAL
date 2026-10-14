import { useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Icons from '../../constants/Icons'; // make sure this path is correct
import { getResponsesAction } from '../../redux/action/common/ApplicationAssessmentAction';
import { getAssessmentByIdAction } from '../../redux/action/common/AssessmentAction';
import { onActivate } from '../../utils/a11y';
import { formatParameterScore } from '../../utils/assessmentScoreUtils';
import { Logger } from '../../utils/logger';
import { AppBadge, AppButton } from '../base';
import AppCommonModal from './AppCommonModal';

const ReviewParameter = ({ open, handleClose, assessmentData }) => {
  const { responses, responsesLoading, responsesError } = useSelector(state => state.ApplicationAssessment);

  const { assessment } = useSelector(state => state.Assessment);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const assessmentId = assessmentData?.assessmentId;
  const storageAssessmentKey = String(assessmentData?.id ?? assessmentData?.assessmentId ?? '') || '';

  useEffect(() => {
    if (assessmentId) {
      dispatch(getResponsesAction(assessmentId));
    }
  }, [dispatch, assessmentId]);
  useEffect(() => {
    if (assessmentId) {
      dispatch(getAssessmentByIdAction(assessmentId));
    }
  }, [dispatch, assessmentId]);
  // Parameters come from responses.parameters in the responses API
  const items = responses?.parameters || [];

  // Parameters that are assigned to a specific team member (truthy `assignedToTeamMemberId`)
  const assignedParams = (items || []).filter(item => item.assignedAssessor !== null);
  const mappedParams = (assignedParams || []).map((p, idx) => ({
    id: String(p.id ?? `p-${idx}`),
    title: p.name || p.title || `Parameter ${idx + 1}`,
    questions: p.questions?.length || p.totalQuestions || p.questionCount || 0,
    score: p.score ?? p.weightedScore ?? p.scoring ?? p.saScore ?? 0,
  }));

  const [selected, setSelected] = useState([]);

  // Restore selected parameters for this assessment from localStorage
  useEffect(() => {
    if (!storageAssessmentKey) {
      return;
    }
    try {
      const key = `review_selected_${storageAssessmentKey}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSelected(parsed.map(String));
        }
      }
    } catch (err) {
      Logger.error('Failed to restore selected parameters', err);
    }
  }, [storageAssessmentKey]);

  // initialize selected when params load
  // useEffect(() => {
  //   if (mappedParams.length && selected.length === 0) {
  //     setSelected(mappedParams.slice(0, 2).map(p => p.id));
  //   }
  // }, [mappedParams]);

  const toggleSelect = id => {
    setSelected(prev => {
      const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
      try {
        if (storageAssessmentKey) {
          localStorage.setItem(`review_selected_${storageAssessmentKey}`, JSON.stringify(next));
        }
      } catch (err) {
        Logger.error('Failed to save selected parameters', err);
      }
      return next;
    });
  };

  const allIds = mappedParams.map(p => String(p.id));
  const allSelected = allIds.length > 0 && allIds.every(id => selected.includes(id));
  const toggleSelectAll = () => {
    const next = allSelected ? [] : allIds;
    setSelected(next);
    try {
      if (storageAssessmentKey) {
        localStorage.setItem(`review_selected_${storageAssessmentKey}`, JSON.stringify(next));
      }
    } catch (err) {
      Logger.error('Failed to save selected parameters', err);
    }
  };

  // Keep selected ids in sync with available parameters (remove stale ids)
  useEffect(() => {
    if (!Array.isArray(mappedParams) || mappedParams.length === 0) {
      // don't cleanup until parameters are available to avoid removing selections prematurely
      return;
    }
    const valid = new Set(mappedParams.map(p => String(p.id)));
    const filtered = selected.filter(id => valid.has(String(id)));
    if (filtered.length !== selected.length) {
      setSelected(filtered);
      try {
        if (storageAssessmentKey) {
          localStorage.setItem(`review_selected_${storageAssessmentKey}`, JSON.stringify(filtered));
        }
      } catch (err) {
        Logger.error('Failed to sync selected parameters', err);
      }
    }
  }, [mappedParams]);
  // Modal title
  const modalTitle = <>Select Parameters to Review</>;
  // Modal content
  const modalContent = (
    <>
      {' '}
      {/* TOP CARD */}
      <div className="parameter-top-card mb-30">
        <div className="row cus-gap-5">
          <div className="col-12 col-md-4">
            <div className="fs-12 fw-500 text-3-color">Enterprise</div>
            <div className="fs-14 fw-500 heading-color">{assessment?.assessment?.application?.organizationName}</div>
          </div>
          <div className="col-12 col-md-4">
            <div className="fs-12 fw-500 text-3-color">Unit Name</div>
            <div className="fs-14 fw-500 heading-color">{assessment?.assessment?.application?.unitName}</div>
          </div>

          <div className="col-12 col-md-4">
            <div className="fs-12 fw-500 text-3-color">Sector</div>
            <div className="fs-14 fw-500 heading-color text-capitalize">{assessment?.assessment?.application?.sector}</div>
          </div>

          <div className="col-12 col-md-4">
            <div className="fs-12 fw-500 text-3-color">Total Parameter</div>
            <div className="fs-14 fw-500 heading-color">{assignedParams.length}</div>
          </div>

          <div className="col-12 col-md-4">
            <div className="fs-12 fw-500 text-3-color">{assessment?.assessment?.application?.sector === 'service' ? 'RA Score' : 'SA Score'}</div>
            <div className="fs-14 fw-500 heading-color">{formatParameterScore(assessment?.assessment?.totalScore)}</div>
          </div>

          <div className="col-12 col-md-4">
            <div className="fs-12 fw-500 text-3-color">Rating</div>
            <div className="fs-14 fw-500 heading-color">{assessment?.assessment?.rating ? String(assessment.assessment.rating).replace(/^Level\s*/i, '') : '--'}</div>
          </div>
        </div>
      </div>
      <div className="divider"></div>
      {/* Selected Count */}
      <div className="d-flex align-items-center justify-content-between">
        <div className="selected-pill fw-600 fs-16 primary-color">
          {selected.length} <span className="fs-12 fw-500 text-1-color margin-left-2">Parameters Selected</span>
        </div>
        {allIds.length > 0 && (
          <button type="button" className="fs-14 fw-500 primary-color" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={toggleSelectAll}>
            {allSelected ? 'Deselect All Parameters' : 'Select All Parameters'}
          </button>
        )}
      </div>
      {/* PARAMETER LIST */}
      <div className="parameter-list-wrapper margin-top-24">
        {responsesLoading ? (
          <div className="d-flex justify-content-center align-items-center py-5">
            <Spinner animation="border" variant="primary" />
          </div>
        ) : responsesError ? (
          <div className="alert alert-danger" role="alert">
            Failed to load parameters: {responsesError?.message || 'Unknown error'}
          </div>
        ) : mappedParams.length === 0 ? (
          <div className="text-center py-5">
            <p className="text-muted">No parameters allocated yet</p>
          </div>
        ) : (
          mappedParams.map(p => (
            <div
              key={p.id}
              className={`parameter-card margin-bottom-10 ${selected.includes(p.id) ? 'active' : ''}`}
              {...onActivate(() => toggleSelect(p.id))}
              role="checkbox"
              aria-checked={selected.includes(p.id)}>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-10">
                  {/* UPDATED CHECKBOX */}
                  <div className="param-checkbox d-flex align-items-center" style={{ cursor: 'pointer' }}>
                    {selected.includes(p.id) ? <img src={Icons.squareTick} alt="" className="icon-22" /> : <img src={Icons.squareUncheck} alt="" className="icon-22" />}
                  </div>

                  <div>
                    <div className="fs-16 fw-500 heading-color">{p.title}</div>
                    <div className="fs-12 fw-400 text-3-color">{p.questions} Questions</div>
                  </div>
                </div>

                {/* Score */}
                <AppBadge variant="lightBlue" label={`Score : ${formatParameterScore(p.score)}`} />
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  // Modal footer
  const modalFooter = (
    <AppButton
      variant="primary"
      size="medium"
      title="Continue"
      disabled={!(Array.isArray(selected) && selected.length)}
      onClick={() =>
        navigate(`/rating-committee/meetings/review-assessment-parameter/${assessmentId}`, {
          state: { selectedParameters: selected, assessmentId },
        })
      }
    />
  );

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      modalFooter={modalFooter}
      paperSx={{
        width: { xs: 'calc(100% - 16px)', sm: '90%', md: '900px', lg: '850px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default ReviewParameter;
