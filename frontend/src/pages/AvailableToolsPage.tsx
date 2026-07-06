import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toolsApi } from '../api/tools';
import type { ToolResponse } from '../types/api';

const categoryLabels: Record<string, string> = {
  HAND_TOOLS: 'Hand Tools',
  POWER_TOOLS: 'Power Tools',
  GARDEN_TOOLS: 'Garden Tools',
  CLEANING_TOOLS: 'Cleaning Tools',
  OUTDOOR_GEAR: 'Outdoor Gear',
};

const categoryOptions = Object.entries(categoryLabels) as Array<[string, string]>;
const BACKEND_ORIGIN = import.meta.env.VITE_API_TARGET || 'http://localhost:8000';

function AvailableToolsPage() {
  const [tools, setTools] = useState<ToolResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchTools = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (categoryFilter) params.category = categoryFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (startDate && endDate) {
        params.available_start = startDate;
        params.available_end = endDate;
      }
      const data = await toolsApi.list(params);
      setTools(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tools');
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, searchTerm, startDate, endDate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTools();
  }, [fetchTools]);

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setStartDate('');
    setEndDate('');
  };

  const getImageUrl = (tool: ToolResponse): string => {
    if (tool.photos.length > 0) {
      return `${BACKEND_ORIGIN}${tool.photos[0].url}`;
    }
    return `https://placehold.co/600x400?text=${encodeURIComponent(tool.name)}`;
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Browse &amp; Search</p>
          <h1>Available Tools</h1>
          <p className="page-description">
            Search available neighborhood tools by keyword, category, and date range.
          </p>
        </div>
      </div>

      <div className="filter-panel">
        <input
          type="text"
          placeholder="Search by tool name or keyword"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="">All categories</option>
          {categoryOptions.map(([value, label]) => (
            <option key={value} value={value}>
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

      {error && <p className="form-error">{error}</p>}
      {isLoading && <p>Loading tools...</p>}

      {!isLoading && !error && (
        <p className="results-summary">
          Showing {tools.length} of {total} tools.
        </p>
      )}

      {!isLoading && !error && tools.length === 0 ? (
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
          {tools.map((tool) => (
            <article className="tool-card" key={tool.id}>
              <img src={getImageUrl(tool)} alt={tool.name} className="tool-image" />

              <div className="tool-card-body">
                <div className="tool-card-top">
                  <span className="status-badge">
                    {categoryLabels[tool.category] || tool.category}
                  </span>
                  <span className="rating">Rating: {tool.avg_rating}/5</span>
                </div>

                <h2>{tool.name}</h2>
                <p>{tool.description}</p>

                <dl className="tool-meta">
                  <div>
                    <dt>Owner</dt>
                    <dd>{tool.owner.full_name || 'Unknown'}</dd>
                  </div>

                  <div>
                    <dt>Condition</dt>
                    <dd>{tool.condition}</dd>
                  </div>
                </dl>

                <Link className="primary-link" to={`/tools/${tool.id}`}>
                  View Details
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default AvailableToolsPage;
