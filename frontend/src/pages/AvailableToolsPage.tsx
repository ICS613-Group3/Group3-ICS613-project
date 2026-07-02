import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  absolutePhotoUrl,
  ApiError,
  toolsApi,
  type Tool,
  type ToolCategory,
} from '../api/client';

/**
 * AvailableToolsPage
 *
 * Real backend browse via ``GET /tools``. Filters are sent to the
 * server as query params; the backend handles category, search, and
 * availability (when both dates are provided).
 *
 * Tool condition values are uppercase enums on the wire; the
 * ``conditionLabels`` map converts them to user-friendly text.
 */
const categoryLabels: Record<ToolCategory, string> = {
  HAND_TOOLS: 'Hand Tools',
  POWER_TOOLS: 'Power Tools',
  GARDEN_TOOLS: 'Garden Tools',
  CLEANING_TOOLS: 'Cleaning Tools',
  OUTDOOR_GEAR: 'Outdoor Gear',
};

const conditionLabels: Record<Tool['condition'], string> = {
  NEW: 'New',
  LIKE_NEW: 'Like New',
  GOOD: 'Good',
  FAIR: 'Fair',
  POOR: 'Poor',
};

const categoryOptions: ToolCategory[] = [
  'HAND_TOOLS',
  'POWER_TOOLS',
  'GARDEN_TOOLS',
  'CLEANING_TOOLS',
  'OUTDOOR_GEAR',
];

function AvailableToolsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ToolCategory | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const params: {
          search?: string;
          category?: ToolCategory;
          available_start?: string;
          available_end?: string;
        } = {};
        if (searchTerm.trim()) params.search = searchTerm.trim();
        if (categoryFilter) params.category = categoryFilter;
        // Only send availability if BOTH dates are set (backend ignores partial).
        if (startDate && endDate) {
          params.available_start = startDate;
          params.available_end = endDate;
        }
        const res = await toolsApi.list(params);
        if (!cancelled) setTools(res.items);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) setErrorMessage(err.message);
          else setErrorMessage('Failed to load tools.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    // Small debounce so typing in the search box doesn't fire a request per keystroke.
    const timeout = setTimeout(load, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchTerm, categoryFilter, startDate, endDate]);

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setStartDate('');
    setEndDate('');
  };

  const isEmpty = !isLoading && tools.length === 0;

  // Track which date inputs the user has touched so we can show a hint
  // about the both-required behavior.
  const hasPartialDates = (startDate && !endDate) || (!startDate && endDate);

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Browse &amp; Search</p>
          <h1>Available Tools</h1>
          <p className="page-description">
            Search available neighborhood tools by keyword, category, and
            date range. Date filters only apply when both start and end are
            set.
          </p>
        </div>
      </div>

      <div className="filter-panel">
        <input
          type="text"
          placeholder="Search by tool name or description"
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
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {categoryLabels[cat]}
            </option>
          ))}
        </select>

        <input
          type="date"
          aria-label="Start date (HST)"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />

        <input
          type="date"
          aria-label="End date (HST)"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
        />

        <button type="button" onClick={clearFilters}>
          Clear Filters
        </button>
      </div>

      <p className="helper-text">Dates are in Hawaii Standard Time (HST).</p>

      {hasPartialDates && (
        <p className="info-banner">
          Set both a start and an end date to filter by availability.
        </p>
      )}

      <p className="results-summary">
        {isLoading ? 'Loading…' : `Showing ${tools.length} tools.`}
      </p>

      {errorMessage && (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      )}

      {isEmpty ? (
        <div className="empty-state-card">
          <p className="eyebrow">No Results</p>
          <h2>No tools match the current filters.</h2>
          <p>Try clearing filters or searching for a different keyword.</p>
          <button type="button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="tool-grid">
          {tools.map((tool) => {
            const photo = tool.photos[0];
            const imageUrl = photo ? absolutePhotoUrl(photo.url) : '';
            return (
              <article className="tool-card" key={tool.id}>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={tool.name}
                    className="tool-image"
                  />
                ) : (
                  <div className="tool-image tool-image-placeholder">
                    No photo
                  </div>
                )}

                <div className="tool-card-body">
                  <div className="tool-card-top">
                    <span className="status-badge">
                      {categoryLabels[tool.category]}
                    </span>
                    <span className="rating">
                      {tool.rating_count > 0
                        ? `★ ${tool.avg_rating.toFixed(1)} (${tool.rating_count})`
                        : 'No reviews yet'}
                    </span>
                  </div>

                  <h2>{tool.name}</h2>
                  <p>{tool.description ?? 'No description provided.'}</p>

                  <dl className="tool-meta">
                    <div>
                      <dt>Owner</dt>
                      <dd>{tool.owner.full_name ?? 'Anonymous'}</dd>
                    </div>

                    <div>
                      <dt>Condition</dt>
                      <dd>{conditionLabels[tool.condition]}</dd>
                    </div>
                  </dl>

                  <Link className="primary-link" to={`/tools/${tool.id}`}>
                    View Details
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

export default AvailableToolsPage;
