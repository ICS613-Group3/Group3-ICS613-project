import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reservationsApi } from '../api/reservations';
import { toolsApi } from '../api/tools';
import type { ReservationResponse, ToolResponse } from '../types/api';

const categoryLabels: Record<string, string> = {
  HAND_TOOLS: 'Hand Tools', POWER_TOOLS: 'Power Tools', GARDEN_TOOLS: 'Garden Tools',
  CLEANING_TOOLS: 'Cleaning Tools', OUTDOOR_GEAR: 'Outdoor Gear',
};

function ReturnedToolsPage() {
  const [tools, setTools] = useState<Array<{ tool: ToolResponse; reservation: ReservationResponse }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    const fetchReturned = async () => {
      setIsLoading(true);
      setError('');
      try {
        // Fetch returned reservations where the current user is the borrower
        const resData = await reservationsApi.list({ role: 'borrower', state: 'RETURNED' });
        // Fetch tool details for each returned reservation
        const pairs = await Promise.all(
          resData.items.map(async (res) => {
            try {
              const t = await toolsApi.get(res.tool_id);
              return { tool: t, reservation: res };
            } catch {
              return null;
            }
          }),
        );
        setTools(pairs.filter((p): p is NonNullable<typeof p> => p !== null));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load returned tools');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReturned();
  }, []);

  const filteredTools = tools.filter(({ tool }) => {
    const matchesCategory = !categoryFilter || tool.category === categoryFilter;
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      tool.name.toLowerCase().includes(normalizedSearch) ||
      (tool.description || '').toLowerCase().includes(normalizedSearch) ||
      (tool.owner.full_name || '').toLowerCase().includes(normalizedSearch);
    return matchesCategory && matchesSearch;
  });

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Browse &amp; Search</p>
          <h1>Returned Tools</h1>
          <p className="page-description">
            Tools you have borrowed and returned. Leave a review from here.
          </p>
        </div>
      </div>

      <div className="filter-panel">
        <input
          type="text"
          placeholder="Search by tool name, description, or owner"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="">All categories</option>
          {Object.entries(categoryLabels).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}
      {isLoading && <p>Loading returned tools...</p>}

      {!isLoading && !error && (
        <p className="results-summary">
          Showing {filteredTools.length} of {tools.length} returned tools.
        </p>
      )}

      {!isLoading && filteredTools.length === 0 ? (
        <div className="empty-state-card">
          <p className="eyebrow">No Results</p>
          <h2>No returned tools found.</h2>
          <p>Tools you borrow and return will appear here.</p>
        </div>
      ) : (
        <div className="tool-grid">
          {filteredTools.map(({ tool, reservation }) => (
            <article className="tool-card" key={tool.id}>
              <img
                src={tool.photos?.[0]?.url || `https://placehold.co/600x400?text=${encodeURIComponent(tool.name)}`}
                alt={tool.name}
                className="tool-image"
              />

              <div className="tool-card-body">
                <div className="tool-card-top">
                  <span className="status-badge">{categoryLabels[tool.category] || tool.category}</span>
                  <span className="rating">Rating: {tool.avg_rating}/5</span>
                </div>

                <h2>{tool.name}</h2>
                <p>{tool.description}</p>

                <dl className="tool-meta">
                  <div><dt>Owner</dt><dd>{tool.owner.full_name || 'Unknown'}</dd></div>
                  <div><dt>Condition</dt><dd>{tool.condition}</dd></div>
                  <div><dt>Returned</dt><dd>{reservation.returned_at ? new Date(reservation.returned_at).toLocaleDateString() : reservation.end_date}</dd></div>
                </dl>

                <Link className="primary-link" to={`/tools/${tool.id}`}>View Details</Link>
                <Link className="secondary-link returned-review-link" to={`/reservations/${reservation.id}/review`}>
                  Review This Tool
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default ReturnedToolsPage;
