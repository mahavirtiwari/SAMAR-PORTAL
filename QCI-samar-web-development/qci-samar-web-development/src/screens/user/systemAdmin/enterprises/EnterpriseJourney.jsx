import PropTypes from 'prop-types';
import { useEffect, useMemo, useState } from 'react';
import SystemAdminEnterprisesService from '../../../../services/api/systemAdmin/EnterprisesService';
import { formatDateTime } from '../../../../utils/formatters';
import './EnterpriseJourney.css';

const CATEGORIES = [
  { value: '', label: 'All steps' },
  { value: 'enterprise', label: 'Registration' },
  { value: 'account', label: 'Accounts' },
  { value: 'application', label: 'Application' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'payment', label: 'Payments' },
  { value: 'certificate', label: 'Certificates' },
];

const service = SystemAdminEnterprisesService();

/**
 * The enterprise's journey, oldest first: registration, user accounts,
 * activation/deactivation with the reason given, every application and assessment
 * status change, payments and certificates. Filter by application or kind of step.
 */
const EnterpriseJourney = ({ organizationId }) => {
  const [applicationId, setApplicationId] = useState('');
  const [category, setCategory] = useState('');
  const [newestFirst, setNewestFirst] = useState(false);
  const [state, setState] = useState({ loading: true, error: null, events: [], applications: [] });

  useEffect(() => {
    if (!organizationId) {
      return undefined;
    }
    let cancelled = false;
    setState(prev => ({ ...prev, loading: true, error: null }));
    service
      .getOrganizationJourney(organizationId, applicationId)
      .then(data => {
        if (!cancelled) {
          // Keep the full application list when a filter narrows the events.
          setState(prev => ({
            loading: false,
            error: null,
            events: Array.isArray(data?.events) ? data.events : [],
            applications: applicationId && prev.applications.length ? prev.applications : Array.isArray(data?.applications) ? data.applications : [],
          }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState(prev => ({ ...prev, loading: false, error: 'The journey could not be loaded. Please try again.' }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, applicationId]);

  const visible = useMemo(() => {
    const filtered = category ? state.events.filter(e => e.category === category) : state.events;
    return newestFirst ? [...filtered].reverse() : filtered;
  }, [state.events, category, newestFirst]);

  return (
    <section className="details-card journey-card" aria-labelledby="journey-title">
      <div className="journey-head">
        <div>
          <h5 id="journey-title" className="heading-color mb-0">
            Enterprise Journey
          </h5>
          <p className="journey-subtitle">Every recorded step, with who did it and any reason given.</p>
        </div>
        <div className="journey-filters">
          <label>
            <span>Application</span>
            <select value={applicationId} onChange={e => setApplicationId(e.target.value)}>
              <option value="">All applications</option>
              {state.applications.map(app => (
                <option key={app.id} value={app.id}>
                  {app.applicationNumber} · {app.statusLabel}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Show</span>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="journey-order" onClick={() => setNewestFirst(v => !v)} aria-pressed={newestFirst}>
            {newestFirst ? 'Newest first' : 'Oldest first'}
          </button>
        </div>
      </div>

      {state.loading ? (
        <p className="journey-empty">Loading the journey…</p>
      ) : state.error ? (
        <p className="journey-empty" role="alert">
          {state.error}
        </p>
      ) : visible.length === 0 ? (
        <p className="journey-empty">No steps recorded yet.</p>
      ) : (
        <ol className="journey-list">
          {visible.map((event, index) => (
            <li key={`${event.type}-${event.at}-${index}`} className={`journey-item journey-${event.category}`}>
              <span className="journey-dot" aria-hidden="true" />
              <div className="journey-body">
                <div className="journey-line">
                  <strong className="journey-title">{event.title}</strong>
                  {event.application ? <span className="journey-app">{event.application.applicationNumber}</span> : null}
                  <time className="journey-time" dateTime={event.at}>
                    {formatDateTime(event.at)}
                  </time>
                </div>
                {event.description ? <p className="journey-desc">{event.description}</p> : null}
                {event.reason ? (
                  <p className="journey-reason">
                    <span>Reason / remarks:</span> {event.reason}
                  </p>
                ) : null}
                {event.actor?.name ? (
                  <p className="journey-actor">
                    By {event.actor.name}
                    {event.actor.role ? ` (${event.actor.role})` : ''}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

EnterpriseJourney.propTypes = {
  organizationId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default EnterpriseJourney;
