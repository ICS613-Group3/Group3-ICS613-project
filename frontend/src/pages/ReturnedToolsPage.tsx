import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  categoryLabels,
  mockTools,
  type ToolCategory,
} from '../data/mockData';
import { formatRating } from '../utils/formatRating';

/**
 * ReturnedToolMockInfo
 *
 * Extra mock information used only on the Returned Tools page.
 * This helps the R1 demo show who returned a tool and who can be reviewed.
 */
type ReturnedToolMockInfo = {
  returnedBy: string;
  reviewTarget: string;
  returnedDate: string;
  reviewUrl: string;
};

/**
 * Mock returned tool data.
 *
 * Uses team member names:
 * - Rion Sawabe
 * - Ivan Wu
 * - Nick Fairhart
 * - Yafei Wang
 * - Loreto Coloma
 *
 * Current mock behavior:
 * - All review buttons go to reservation-4 review page.
 * - reservation-4 is RETURNED, so the US24 Review page allows submission.
 *
 * Future backend behavior:
 * - Each returned tool should link to its real returned reservation review page.
 */
const returnedToolInfoById: Record<string, ReturnedToolMockInfo> = {
  'tool-1': {
    returnedBy: 'Nick Fairhart',
    reviewTarget: 'Rion Sawabe',
    returnedDate: '2026-06-20',
    reviewUrl: '/reservations/reservation-4/review',
  },
  'tool-2': {
    returnedBy: 'Loreto Coloma',
    reviewTarget: 'Ivan Wu',
    returnedDate: '2026-06-22',
    reviewUrl: '/reservations/reservation-4/review',
  },
  'tool-3': {
    returnedBy: 'Yafei Wang',
    reviewTarget: 'Rion Sawabe',
    returnedDate: '2026-06-27',
    reviewUrl: '/reservations/reservation-4/review',
  },
  'tool-4': {
    returnedBy: 'Ivan Wu',
    reviewTarget: 'Yafei Wang',
    returnedDate: '2026-06-16',
    reviewUrl: '/reservations/reservation-4/review',
  },
  'tool-5': {
    returnedBy: 'Rion Sawabe',
    reviewTarget: 'Yafei Wang',
    returnedDate: '2026-06-30',
    reviewUrl: '/reservations/reservation-4/review',
  },
};

/**
 * ReturnedToolsPage
 *
 * This page shows returned tools using the same card layout as Available Tools.
 *
 * Current R1 behavior:
 * - Uses mock returned data above.
 * - Supports search, category, and date filters.
 * - Shows Review This Tool button.
 *
 * Future backend behavior:
 * - Backend should provide returned reservations/tools that are ready for review.
 */
function ReturnedToolsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ToolCategory | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const categoryOptions = Object.entries(categoryLabels) as Array<
    [ToolCategory, string]
  >;

  /**
   * Returned tools are tools with returned mock info.
   * This keeps Returned Tools separate from Available Tools.
   */
  const returnedTools = useMemo(
    () => mockTools.filter((tool) => returnedToolInfoById[tool.id]),
    [],
  );

  /**
   * Local mock filtering for Returned Tools.
   *
   * Search checks:
   * - tool name
   * - description
   * - owner
   * - category
   * - returnedBy
   * - reviewTarget
   */
  const filteredTools = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return returnedTools.filter((tool) => {
      const categoryLabel = categoryLabels[tool.category];
      const returnedInfo = returnedToolInfoById[tool.id];

      const matchesSearch =
        normalizedSearch.length === 0 ||
        tool.name.toLowerCase().includes(normalizedSearch) ||
        tool.description.toLowerCase().includes(normalizedSearch) ||
        tool.ownerName.toLowerCase().includes(normalizedSearch) ||
        categoryLabel.toLowerCase().includes(normalizedSearch) ||
        returnedInfo.returnedBy.toLowerCase().includes(normalizedSearch) ||
        returnedInfo.reviewTarget.toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        categoryFilter === '' || tool.category === categoryFilter;

      /**
       * Date filter:
       * If the user only enters one date, use it as both start and end.
       */
      const selectedStartDate = startDate || endDate;
      const selectedEndDate = endDate || startDate;

      const matchesDateRange =
        !selectedStartDate ||
        !selectedEndDate ||
        (tool.availableFrom <= selectedStartDate &&
          tool.availableTo >= selectedEndDate);

      return matchesSearch && matchesCategory && matchesDateRange;
    });
  }, [categoryFilter, endDate, returnedTools, searchTerm, startDate]);

  /**
   * Reset all filters so all returned mock tools are visible again.
   */
  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Browse &amp; Search</p>
          <h1>Returned Tools</h1>
          <p className="page-description">
            View returned tools using mock data and open the US24 review
            workflow.
          </p>
        </div>
      </div>

      <div className="filter-panel">
        <input
          type="text"
          placeholder="Search by tool, owner, returned by, or review target"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <select
          value={categoryFilter}
          onChange={(event) =>
            setCategoryFilter(event.target.value as ToolCategory | '')
          }
        >
          <option value="">All categories</option>
          {categoryOptions.map(([categoryValue, label]) => (
            <option key={categoryValue} value={categoryValue}>
              {label}
            </option>
          ))}
        </select>

        <input
          type="date"
          aria-label="Start date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />

        <input
          type="date"
          aria-label="End date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
        />

        <button type="button" onClick={clearFilters}>
          Clear Filters
        </button>
      </div>

      <p className="results-summary">
        Showing {filteredTools.length} of {returnedTools.length} returned tools.
      </p>

      {filteredTools.length === 0 ? (
        <div className="empty-state-card">
          <p className="eyebrow">No Results</p>
          <h2>No returned tools match the current filters.</h2>
          <p>Try clearing filters or searching for a different keyword.</p>
          <button type="button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="tool-grid">
          {filteredTools.map((tool) => {
            const returnedInfo = returnedToolInfoById[tool.id];

            return (
              <article className="tool-card" key={tool.id}>
                <img
                  src={tool.imageUrl}
                  alt={tool.name}
                  className="tool-image"
                />

                <div className="tool-card-body">
                  <div className="tool-card-top">
                    <span className="status-badge">
                      {categoryLabels[tool.category]}
                    </span>
                    <span className="rating">Rating: {formatRating(tool.rating)}/5</span>
                  </div>

                  <h2>{tool.name}</h2>
                  <p>{tool.description}</p>

                  <dl className="tool-meta">
                    <div>
                      <dt>Owner</dt>
                      <dd>{tool.ownerName}</dd>
                    </div>

                    <div>
                      <dt>Condition</dt>
                      <dd>{tool.condition}</dd>
                    </div>

                    <div>
                      <dt>Availability</dt>
                      <dd>{tool.availability}</dd>
                    </div>

                    <div>
                      <dt>Latest return</dt>
                      <dd>{tool.latestReturnTime} HST</dd>
                    </div>

                    <div>
                      <dt>Returned by</dt>
                      <dd>{returnedInfo.returnedBy}</dd>
                    </div>

                    <div>
                      <dt>Returned date</dt>
                      <dd>{returnedInfo.returnedDate}</dd>
                    </div>

                    <div>
                      <dt>Review target</dt>
                      <dd>{returnedInfo.reviewTarget}</dd>
                    </div>
                  </dl>

                  <Link className="primary-link" to={`/tools/${tool.id}`}>
                    View Details
                  </Link>

                  <Link
                    className="secondary-link returned-review-link"
                    to={returnedInfo.reviewUrl}
                  >
                    Review This Tool
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default ReturnedToolsPage;
