import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
import './StateWiseEnterpriseTable.css';

const TOP_COUNT = 10;
const number = value => Number(value) || 0;
const formatCount = value => number(value).toLocaleString('en-IN');
const rateOf = (certified, registered) => (registered > 0 ? Math.round((certified / registered) * 100) : 0);

/**
 * State-wise enterprises on the role dashboards: totals, then states ranked by
 * registrations with each state's share and certification rate. Shows the top 10
 * with a toggle for the rest.
 */
const StateWiseEnterpriseTable = ({ rows = [], title = 'State-wise Enterprises' }) => {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');

  const states = useMemo(
    () =>
      (Array.isArray(rows) ? rows : [])
        .map(row => ({
          state: row.state || '—',
          registered: number(row.registered),
          draft: number(row.draft),
          certified: number(row.certified),
        }))
        .sort((a, b) => b.registered - a.registered || b.certified - a.certified || a.state.localeCompare(b.state)),
    [rows],
  );

  const totals = useMemo(
    () => states.reduce((acc, s) => ({ registered: acc.registered + s.registered, draft: acc.draft + s.draft, certified: acc.certified + s.certified }), { registered: 0, draft: 0, certified: 0 }),
    [states],
  );
  const maxRegistered = states[0]?.registered || 0;
  // Searching shows every matching state; ranks stay the state's place in the full list.
  const needle = query.trim().toLowerCase();
  const ranked = states.map((s, index) => ({ ...s, rank: index + 1 }));
  const matches = needle ? ranked.filter(s => s.state.toLowerCase().includes(needle)) : ranked;
  const visible = needle || showAll ? matches : matches.slice(0, TOP_COUNT);
  const hiddenCount = matches.length - visible.length;

  return (
    <section className="state-table-card" aria-labelledby="state-table-title">
      <div className="state-table-head">
        <div>
          <h2 id="state-table-title" className="state-table-title">
            {title}
          </h2>
          <p className="state-table-subtitle">
            {states.length} {states.length === 1 ? 'state / UT' : 'states / UTs'}, ranked by registered enterprises
          </p>
        </div>
        <dl className="state-table-totals">
          <div>
            <dt>Registered</dt>
            <dd>{formatCount(totals.registered)}</dd>
          </div>
          <div>
            <dt>Draft</dt>
            <dd>{formatCount(totals.draft)}</dd>
          </div>
          <div>
            <dt>Certified</dt>
            <dd className="is-certified">{formatCount(totals.certified)}</dd>
          </div>
          <div>
            <dt>Certification rate</dt>
            <dd>{rateOf(totals.certified, totals.registered)}%</dd>
          </div>
        </dl>
      </div>

      {states.length > 0 && (
        <div className="state-table-search">
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search state / UT" aria-label="Search state or UT" />
          {needle ? (
            <span>
              {matches.length} of {states.length} shown
            </span>
          ) : null}
        </div>
      )}

      {states.length === 0 ? (
        <p className="state-table-empty">No state-wise data yet.</p>
      ) : matches.length === 0 ? (
        <p className="state-table-empty">No state or UT matches "{query.trim()}".</p>
      ) : (
        <div className="state-table-scroll">
          <table className="state-table">
            <thead>
              <tr>
                <th scope="col" className="col-rank">
                  #
                </th>
                <th scope="col">State / UT</th>
                <th scope="col" className="col-num">
                  Registered
                </th>
                <th scope="col" className="col-num">
                  Draft
                </th>
                <th scope="col" className="col-num">
                  Certified
                </th>
                <th scope="col" className="col-rate">
                  Certification rate
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map(s => {
                const share = maxRegistered > 0 ? (s.registered / maxRegistered) * 100 : 0;
                const rate = rateOf(s.certified, s.registered);
                return (
                  <tr key={s.state}>
                    <td className="col-rank">{s.rank}</td>
                    <th scope="row" className="col-state">
                      {s.state}
                    </th>
                    <td className="col-num">
                      <div className="num-with-bar">
                        <span className="share-bar" aria-hidden="true">
                          <span style={{ width: `${share}%` }} />
                        </span>
                        <span>{formatCount(s.registered)}</span>
                      </div>
                    </td>
                    <td className="col-num">{formatCount(s.draft)}</td>
                    <td className="col-num is-certified">{formatCount(s.certified)}</td>
                    <td className="col-rate">
                      <div className="rate-cell">
                        <span className="rate-bar" aria-hidden="true">
                          <span style={{ width: `${rate}%` }} />
                        </span>
                        <span className="rate-value">{rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="col-rank" />
                <th scope="row" className="col-state">
                  Total
                </th>
                <td className="col-num">{formatCount(totals.registered)}</td>
                <td className="col-num">{formatCount(totals.draft)}</td>
                <td className="col-num is-certified">{formatCount(totals.certified)}</td>
                <td className="col-rate">
                  <span className="rate-value">{rateOf(totals.certified, totals.registered)}%</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!needle && states.length > TOP_COUNT && (
        <div className="state-table-more">
          <button type="button" onClick={() => setShowAll(v => !v)} aria-expanded={showAll}>
            {showAll ? `Show top ${TOP_COUNT} only` : `Show all ${states.length} (${hiddenCount} more)`}
          </button>
        </div>
      )}
    </section>
  );
};

StateWiseEnterpriseTable.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      state: PropTypes.string,
      registered: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      draft: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      certified: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    }),
  ),
  title: PropTypes.string,
};

export default StateWiseEnterpriseTable;
