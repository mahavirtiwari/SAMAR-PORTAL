import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Icons from '../../constants/Icons'; // make sure this path is correct
import { formatParameterScore } from '../../utils/assessmentScoreUtils';
import { AppBadge, AppButton } from '../base';
import AppCommonModal from './AppCommonModal';

const AddParameterReviewModal = ({ open, onClose, onSelect, initialSelected, assessment }) => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (Array.isArray(initialSelected) && initialSelected.length) {
      setSelected(initialSelected.map(String));
    } else {
      setSelected([]);
    }
  }, [open, initialSelected]);
  const { responses } = useSelector(state => state.ApplicationAssessment || {});
  const parameters =
    responses && Array.isArray(responses.parameters)
      ? responses.parameters.map(p => ({
          id: p.id,
          title: p.name || p.title || p.label || `Parameter ${p.id}`,
          questions: Array.isArray(p.questions) ? p.questions.length : p.totalQuestions || p.questionCount || 0,
          score: p.saScore ?? p.weightedScore ?? p.score ?? 0,
          assignedAssessor: p.assignedAssessor ?? p.assessor ?? p.assignedAssessor ?? null,
        }))
      : [];

  // Only show parameters that are not already selected (deselected ones)
  const initialIds = Array.isArray(initialSelected) ? initialSelected.map(String) : [];
  const visibleParameters = parameters.filter(p => {
    // Exclude parameters where assignedAssessor is null
    if (p.assignedAssessor == null) {
      return false;
    }
    return !initialIds.includes(String(p.id));
  });
  const toggleSelect = id => {
    const sid = String(id);
    setSelected(prev => (prev.map(String).includes(sid) ? prev.filter(i => String(i) !== sid) : [...prev, sid]));
  };

  // Modal title
  const modalTitle = <>Add Parameters to Review</>;

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
            <div className="fs-14 fw-500 heading-color">{responses?.parameters?.length ?? '--'}</div>
          </div>

          <div className="col-12 col-md-4">
            <div className="fs-12 fw-500 text-3-color">Assessment Score</div>
            <div className="fs-14 fw-500 heading-color">{formatParameterScore(assessment?.assessment?.totalScore)}</div>
          </div>

          <div className="col-12 col-md-4">
            <div className="fs-12 fw-500 text-3-color">Rating</div>
            <div className="fs-14 fw-500 heading-color">{assessment?.assessment?.rating ?? '--'}</div>
          </div>
        </div>
      </div>
      <div className="divider"></div>
      {/* Selected Count */}
      <div className="d-flex align-items-center justify-content-between">
        <div className="selected-pill fw-600 fs-16 primary-color">
          {selected.length} <span className="fs-12 fw-500 text-1-color margin-left-2">Parameters Selected</span>
        </div>
        {/* <div className="assessmentDate">
          <div className="assessmentDateDate">
            <img src={Icons.calendarBlue} alt="" /> <span className="fs-12 fw-500 text-3-color margin-left-2 margin-right-2">Assessment Date:</span>
          </div>
          <span className="fs-14 fw-500 text-1-color margin-left-6">15 Jun 2025 -18 Jun 2025 </span>
        </div> */}
      </div>
      {/* PARAMETER LIST */}
      <div className="parameter-list-wrapper margin-top-24">
        {visibleParameters.map(p => (
          <div key={p.id} className={`parameter-card margin-bottom-10 ${selected.map(String).includes(String(p.id)) ? 'active' : ''}`} onClick={() => toggleSelect(p.id)}>
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-10">
                {/* UPDATED CHECKBOX */}
                <div className="param-checkbox d-flex align-items-center" style={{ cursor: 'pointer' }}>
                  {selected.map(String).includes(String(p.id)) ? (
                    <img src={Icons.squareTick} alt="checkbox" className="icon-22" />
                  ) : (
                    <img src={Icons.squareUncheck} alt="checkbox" className="icon-22" />
                  )}
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
        ))}
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
      onClick={() => {
        if (typeof onSelect === 'function') {
          onSelect(selected);
          if (typeof onClose === 'function') {
            onClose();
          }
          return;
        }
        navigate('/rating-committee/meetings/review-assessment-parameter', {
          state: { selectedParameters: selected },
        });
      }}
    />
  );

  return (
    <AppCommonModal
      open={open}
      onClose={onClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      modalFooter={modalFooter}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '900px', lg: '850px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default AddParameterReviewModal;
