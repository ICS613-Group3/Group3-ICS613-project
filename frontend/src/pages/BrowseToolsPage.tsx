import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  categoryLabels,
  mockTools,
  type ToolCategory,
} from '../data/mockData';

/**
 * BrowseToolsPage
 *
 * This page displays all available tools using mock data.
 * For R1 demo feedback, search and category filters now work locally.
 * Later, Ivan can replace this local filtering with backend API query params.
 */
function BrowseToolsPage() {
  // Search text entered by the user.
  const [searchTerm, setSearchTerm] = useState('');

  // Backend-aligned category enum selected by the user.
  const [categoryFilter, setCategoryFilter] = useState<ToolCategory | ''>('');

  // Date filters are interpreted as HST calendar dates for the demo.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const categoryOptions = Object.entries(categoryLabels) as Array<
    [ToolCategory, string]
  >;

  /**
   * filteredTools
   *
   * This local filtering makes the demo interactive before backend integration.
   * Search checks name, description, owner, and category label.
   * Category uses backend enum values.
   * Date filter checks whether the selected date range fits inside the mock availability window.
   */
  const filteredTools = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return mockTools.filter((tool) => {
      const categoryLabel = categoryLabels[tool.category];

      const matchesSearch =
        normalizedSearch.length === 0 ||
        tool.name.toLowerCase().includes(normalizedSearch) ||
        tool.description.toLowerCase().includes(normalizedSearch) ||
        tool.ownerName.toLowerCase().includes(normalizedSearch) ||
        categoryLabel.toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        categoryFilter === '' || tool.category === categoryFilter;

      const selectedStartDate = startDate || endDate;
      const selectedEndDate = endDate || startDate;

      const matchesDateRange =
        !selectedStartDate ||
        !selectedEndDate ||
        (tool.availableFrom <= selectedStartDate &&
          tool.availableTo >= selectedEndDate);

      return matchesSearch && matchesCategory && matchesDateRange;
    });
  }, [categoryFilter, endDate, searchTerm, startDate]);

  /**
   * Clears all filter controls and shows every mock tool again.
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
          <p className="eyebrow">Browse & Search</p>
          <h1>Available Tools</h1>
          <p className="page-description">
            Search available neighborhood tools by keyword, backend-aligned
            category, and HST date range.
          </p>
        </div>
      </div>

      <div className="filter-panel">
        <input
          type="text"
          placeholder="Search by tool, owner, or keyword"
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
        Showing {filteredTools.length} of {mockTools.length} tools.
      </p>

      {filteredTools.length === 0 ? (
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
          {filteredTools.map((tool) => (
            <article className="tool-card" key={tool.id}>
              <img src={tool.imageUrl} alt={tool.name} className="tool-image" />

              <div className="tool-card-body">
                <div className="tool-card-top">
                  <span className="status-badge">
                    {categoryLabels[tool.category]}
                  </span>
                  <span className="rating">Rating: {tool.rating}/5</span>
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

export default BrowseToolsPage;
