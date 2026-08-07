import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import PaginationControls from '../components/PaginationControls';
import { DEFAULT_PAGE_SIZE } from '../hooks/useClientPagination';

import { toolsApi } from '../api/tools';
import type {
  ToolCondition,
  ToolResponse,
} from '../types/api';
import { useCategories } from '../hooks/useCategories';
import { HST_UI_NOTE } from '../utils/hstDateTime';

const conditionOptions: Array<{
  label: string;
  value: ToolCondition;
}> = [
  { value: 'NEW', label: 'New' },
  { value: 'LIKE_NEW', label: 'Like New' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'POOR', label: 'Poor' },
];

const conditionLabels: Record<ToolCondition, string> =
  Object.fromEntries(
    conditionOptions.map((option) => [
      option.value,
      option.label,
    ]),
  ) as Record<ToolCondition, string>;

function AvailableToolsPage() {
  const { categoryLabels, categoryOptions } = useCategories();

  const [tools, setTools] = useState<ToolResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] =
    useState(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] =
    useState('');
  const [conditionFilter, setConditionFilter] =
    useState<ToolCondition | ''>('');
  const [minimumRatingFilter, setMinimumRatingFilter] =
    useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchTools = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const data = await toolsApi.list({
        category: categoryFilter || undefined,
        search: searchTerm.trim() || undefined,
        condition: conditionFilter || undefined,
        min_rating: minimumRatingFilter
          ? Number(minimumRatingFilter)
          : undefined,
        available_start:
          startDate && endDate ? startDate : undefined,
        available_end:
          startDate && endDate ? endDate : undefined,
        page: currentPage,
        page_size: DEFAULT_PAGE_SIZE,
      });

      setTools(data.items);
      setTotal(data.total);
      setPageSize(data.page_size);
      setTotalPages(data.pages);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load tools.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    categoryFilter,
    conditionFilter,
    currentPage,
    endDate,
    minimumRatingFilter,
    searchTerm,
    startDate,
  ]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setConditionFilter('');
    setMinimumRatingFilter('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const getImageUrl = (tool: ToolResponse): string => {
    if (tool.photos.length > 0) {
      return tool.photos[0].url;
    }

    return `https://placehold.co/600x400?text=${encodeURIComponent(
      tool.name,
    )}`;
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Browse &amp; Search</p>
          <h1>Available Tools</h1>
          <p className="page-description">
            Search neighborhood tools by keyword, category,
            condition, minimum rating, and HST date range.
          </p>
        </div>
      </div>

      <div className="filter-panel">
        <input
          type="text"
          aria-label="Search tools"
          placeholder="Search by tool name or keyword"
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setCurrentPage(1);
          }}
        />

        <select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(event) => {
            setCategoryFilter(event.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="">All categories</option>

          {categoryOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by condition"
          value={conditionFilter}
          onChange={(event) => {
            setConditionFilter(
              event.target.value as ToolCondition | '',
            );
            setCurrentPage(1);
          }}
        >
          <option value="">All conditions</option>

          {conditionOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by minimum rating"
          value={minimumRatingFilter}
          onChange={(event) => {
            setMinimumRatingFilter(event.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="">Any rating</option>
          <option value="4">4 stars and up</option>
          <option value="3">3 stars and up</option>
          <option value="2">2 stars and up</option>
          <option value="1">1 star and up</option>
        </select>

        <label className="filter-date-field">
          <span>Start Date (HST)</span>
          <input
            type="date"
            aria-label="Start Date (HST)"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              setCurrentPage(1);
            }}
          />
        </label>

        <label className="filter-date-field">
          <span>End Date (HST)</span>
          <input
            type="date"
            aria-label="End Date (HST)"
            value={endDate}
            onChange={(event) => {
              setEndDate(event.target.value);
              setCurrentPage(1);
            }}
          />
        </label>

        <button
          type="button"
          className="secondary-button"
          onClick={clearFilters}
        >
          Clear Filters
        </button>
      </div>

      <p className="hst-note filter-hst-note">
        {HST_UI_NOTE}
      </p>

      {error && <p className="form-error">{error}</p>}

      {isLoading && <p>Loading tools...</p>}

      {!isLoading && !error && (
        <p className="results-summary">
          Showing {tools.length} of {total} matching tools.
        </p>
      )}

      {!isLoading && !error && (
        tools.length === 0 ? (
          <div className="empty-state-card">
            <p className="eyebrow">No Results</p>
            <h2>
              {searchTerm
                ? 'No tools found matching your search.'
                : categoryFilter
                  ? 'No tools in this category yet.'
                  : 'No tools available right now.'}
            </h2>
            <p>
              {searchTerm
                ? 'Try a different keyword or browse all tools.'
                : categoryFilter
                  ? 'Browse all categories.'
                  : 'Be the first to list a tool!'}
            </p>

            <button
              type="button"
              className="secondary-button"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="tool-grid">
            {tools.map((tool) => (
              <article
                className="tool-card"
                key={tool.id}
              >
                <img
                  src={getImageUrl(tool)}
                  alt={tool.name}
                  className="tool-image"
                />

                <div className="tool-card-body">
                  <div className="tool-card-top">
                    <span className="status-badge">
                      {categoryLabels[tool.category] ||
                        tool.category}
                    </span>

                    <span className="rating">
                      Rating: {tool.avg_rating.toFixed(1)}/5
                    </span>
                  </div>

                  <h2>{tool.name}</h2>

                  <p>
                    {tool.description ||
                      'No description provided.'}
                  </p>

                  <dl className="tool-meta">
                    <div>
                      <dt>Owner</dt>
                      <dd>
                        {tool.owner.full_name || 'Unknown'}
                      </dd>
                    </div>

                    <div>
                      <dt>Condition</dt>
                      <dd>
                        {conditionLabels[tool.condition]}
                      </dd>
                    </div>

                    <div>
                      <dt>Reviews</dt>
                      <dd>{tool.rating_count}</dd>
                    </div>
                  </dl>

                  <Link
                    className="primary-link"
                    to={`/tools/${tool.id}`}
                  >
                    View Details
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {!isLoading && !error && (
        <PaginationControls
          currentPage={currentPage}
          itemLabel="tools"
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          totalItems={total}
          totalPages={totalPages}
        />
      )}
    </section>
  );
}

export default AvailableToolsPage;
